import base64
import json
import os
import re
import smtplib
import socket
import time
import urllib.parse
from email.mime.text import MIMEText
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")


DEFAULT_CONFIG = {
    "github_raw_url": "https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub1.txt",
    "email_address": "your_sender_email@example.com",
    "email_password": "YOUR_APP_PASSWORD",
    "recipient_email": "your_recipient_email@example.com",
    "latency_threshold_ms": 200,
    "test_timeout": 1,
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "email_subject": "V2Ray/VLESS Configs with Low Latency",
    "test_url": "http://cp.cloudflare.com/",
}

CONFIG_FILE = Path("config.json")

app_config = {}

try:
    from telegram import (
        BotCommand,
        InlineKeyboardButton,
        InlineKeyboardMarkup,
        MenuButtonCommands,
        Update,
    )
    from telegram.ext import (
        Application,
        CallbackQueryHandler,
        CommandHandler,
        ContextTypes,
        ConversationHandler,
        MessageHandler,
        filters,
    )
except ImportError:
    print("Error: 'python-telegram-bot' library not found.")
    print("Please install it using: pip install python-telegram-bot requests")
    exit()

(
    EDITING_GITHUB_URL,
    EDITING_EMAIL_ADDRESS,
    EDITING_EMAIL_PASSWORD,
    EDITING_RECIPIENT_EMAIL,
    EDITING_LATENCY_THRESHOLD,
    EDITING_TEST_TIMEOUT,
) = range(6)


def load_config() -> Dict:
    """Load configuration from JSON file, or create default if it doesn't exist."""
    global app_config
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                app_config = json.load(f)

            for key, value in DEFAULT_CONFIG.items():
                if key not in app_config:
                    app_config[key] = value
            print(f"✓ Configuration loaded from {CONFIG_FILE}")

        except Exception as e:
            print(f"⚠️  Error loading config file: {e}. Using defaults.")
            app_config = DEFAULT_CONFIG.copy()
            save_config()
    else:
        app_config = DEFAULT_CONFIG.copy()
        save_config()
        print(f"✓ Created default configuration file: {CONFIG_FILE}")
    return app_config


def save_config() -> None:
    """Save current configuration to JSON file."""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(app_config, f, indent=2, ensure_ascii=False)
        print(f"✓ Configuration saved to {CONFIG_FILE}")
    except Exception as e:
        print(f"✗ Error saving config file: {e}")


def get_config_value(key: str, default=None):
    """Get a configuration value."""
    return app_config.get(key, default)


load_config()


def _decode_vmess(link: str) -> Optional[Dict]:
    """Decodes a VMESS link to extract host and port."""
    try:
        encoded_json = link[8:].strip()
        encoded_json = re.sub(r"[^A-Za-z0-9+/=]+$", "", encoded_json)
        missing_padding = len(encoded_json) % 4
        if missing_padding:
            encoded_json += "=" * (4 - missing_padding)

        decoded_bytes = base64.b64decode(encoded_json, validate=True)
        config = json.loads(decoded_bytes.decode("utf-8"))

        if "add" in config and "port" in config:
            return {
                "protocol": "vmess",
                "host": config["add"],
                "port": str(config["port"]),
                "original_link": link,
            }
        return None
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    except Exception as e:
        error_str = str(e).lower()
        if "incorrect padding" in error_str or "invalid" in error_str:
            return None
        return None


def _parse_vless_v2ray(link: str) -> Optional[Dict]:
    """Parses VLESS/V2RAY links to extract host and port. (Simplified parsing for general links)"""
    try:
        if link.startswith("vless://"):
            link_part = link[8:]
            protocol_name = "vless"
        elif link.startswith("v2ray://"):
            link_part = link[8:]
            protocol_name = "v2ray"
        else:
            return None

        match = re.search(r"(@|//)([^@?]+:\d+)", link_part)
        if match:
            host_port = match.group(2)
            host, port = host_port.rsplit(":", 1)
            return {
                "protocol": protocol_name,
                "host": host,
                "port": port,
                "original_link": link,
            }

        if ":" in link_part and "@" not in link_part:
            host_port = link_part.split("?")[0]
            host, port = host_port.rsplit(":", 1)
            return {
                "protocol": protocol_name,
                "host": host,
                "port": port,
                "original_link": link,
            }

        return None
    except Exception as e:
        print(f"Error parsing VLESS/V2RAY link {link}: {e}")
        return None


def _parse_other_protocols(link: str) -> Optional[Dict]:
    """Parses SS, Trojan, and Hysteria2 links to extract host and port."""
    try:
        if link.startswith("ss://"):
            protocol_name = "ss"
            link_part = link[5:]
        elif link.startswith("trojan://"):
            protocol_name = "trojan"
            link_part = link[9:]
        elif link.startswith("hysteria2://"):
            protocol_name = "hysteria2"
            link_part = link[12:]
        else:
            return None

        link_part = link_part.split("?")[0]
        link_part = link_part.split("#")[0]

        if "@" in link_part:
            parts = link_part.split("@")
            if len(parts) == 2:
                host_port = parts[1]
                if ":" in host_port:
                    host, port = host_port.rsplit(":", 1)
                    return {
                        "protocol": protocol_name,
                        "host": host,
                        "port": port,
                        "original_link": link,
                    }
        else:
            if ":" in link_part:
                host, port = link_part.rsplit(":", 1)
                return {
                    "protocol": protocol_name,
                    "host": host,
                    "port": port,
                    "original_link": link,
                }

        return None
    except Exception as e:
        print(
            f"Error parsing {protocol_name if 'protocol_name' in locals() else 'protocol'} link {link}: {e}"
        )
        return None


def extract_vpn_links(raw_content: str) -> List[str]:
    """
    Decodes the raw, URL-encoded content and extracts V2Ray-compatible links
    including vmess, vless, v2ray, ss, trojan, and hysteria2 protocols.

    Args:
        raw_content: The raw string response, potentially URL-encoded and containing JSON escapes.

    Returns:
        A list of cleaned VPN configuration links.
    """

    try:
        decoded_content = urllib.parse.unquote(raw_content)
    except Exception as e:
        print(f"Warning: Could not URL-decode content. Proceeding with raw string. Error: {e}")
        decoded_content = raw_content

    protocol_pattern = r"(?:vmess|vless|v2ray|ss|trojan|hysteria2)://[^\"}\s]+"

    links = re.findall(protocol_pattern, decoded_content)

    cleaned_links = []
    for link in links:
        cleaned = link.replace("\\u0026", "&")
        cleaned = cleaned.replace("\\/", "/")
        if cleaned.startswith("vmess://"):
            match = re.match(r"(vmess://)([A-Za-z0-9+/=]+)", cleaned)
            if match:
                cleaned = match.group(1) + match.group(2)
        cleaned_links.append(cleaned)

    return cleaned_links


def get_and_parse_configs() -> List[Dict]:
    """Fetches raw config data from GitHub and parses valid links."""
    github_url = get_config_value("github_raw_url")
    print("=" * 60)
    print("Fetching configs from GitHub...")
    print(f"URL: {github_url}")

    try:
        client = httpx.Client(timeout=30.0)
        response = client.get(github_url)
        response.raise_for_status()
        raw_content = response.text
        print(f"✓ Successfully fetched content ({len(raw_content)} characters)")
    except Exception as e:
        print(f"✗ Error fetching from GitHub: {e}")
        return []

    links = extract_vpn_links(raw_content)
    print(f"✓ Found {len(links)} raw links in content")

    parsed_configs = []
    failed_links = []
    for link in set(links):
        link = link.strip()
        if not link:
            continue

        config = None
        if link.startswith("vmess://"):
            config = _decode_vmess(link)
        elif link.startswith("vless://") or link.startswith("v2ray://"):
            config = _parse_vless_v2ray(link)
        elif (
            link.startswith("ss://")
            or link.startswith("trojan://")
            or link.startswith("hysteria2://")
        ):
            config = _parse_other_protocols(link)

        if config:
            parsed_configs.append(config)
        else:
            failed_links.append(link[:80] + "..." if len(link) > 80 else link)

    if failed_links:
        print(f"⚠️  {len(failed_links)} link(s) could not be parsed (invalid format)")

    print(f"✓ Successfully parsed {len(parsed_configs)} unique configurations")
    print("=" * 60)
    return parsed_configs


def test_tcp_connection(host: str, port: str) -> Optional[float]:
    """Tests TCP connection to host:port and returns latency in milliseconds."""
    try:
        port_int = int(port)
        start_time = time.time()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        test_timeout = get_config_value("test_timeout", 5)
        sock.settimeout(test_timeout)
        result = sock.connect_ex((host, port_int))
        end_time = time.time()
        sock.close()

        if result == 0:
            latency_ms = (end_time - start_time) * 1000
            return latency_ms
        return None
    except Exception:
        return None


def test_proxy_latency(config: Dict) -> Optional[float]:
    """Tests a proxy connection by measuring time to fetch a test URL through the proxy."""
    host = config["host"]
    port = config["port"]

    tcp_latency = test_tcp_connection(host, port)
    if tcp_latency is None:
        return None

    start_time = time.time()
    try:
        proxy_url = f"http://{host}:{port}"
        proxies = {"http": proxy_url, "https": proxy_url}

        test_url = get_config_value("test_url", "http://cp.cloudflare.com/")
        test_timeout = get_config_value("test_timeout", 5)
        response = httpx.get(
            test_url,
            proxies=proxies,
            timeout=test_timeout,
            verify=False,
            follow_redirects=True,
        )
        response.raise_for_status()
        end_time = time.time()
        latency_ms = (end_time - start_time) * 1000
        return latency_ms
    except (httpx.RequestError, httpx.ProxyError, httpx.ConnectError):
        return tcp_latency
    except Exception:
        return tcp_latency


def process_configs() -> Tuple[str, str, List[Dict]]:
    """Main function to fetch, test, filter, and format results.

    Returns:
        Tuple of (telegram_summary, result_content, low_latency_configs)
    """

    all_configs = get_and_parse_configs()
    if not all_configs:
        error_msg = "Failed to retrieve or parse configs."
        print(f"\n{error_msg}")
        return error_msg, "", []

    low_latency_configs = []

    latency_threshold = get_config_value("latency_threshold_ms", 200)
    test_url = get_config_value("test_url", "http://cp.cloudflare.com/")
    print(f"\n{'=' * 60}")
    print(f"Starting latency tests on {len(all_configs)} configurations...")
    print(f"Threshold: < {latency_threshold}ms")
    print(f"Test URL: {test_url}")
    print(f"{'=' * 60}\n")

    status_updates = [f"Starting latency tests on {len(all_configs)} configurations..."]

    for i, config in enumerate(all_configs, 1):
        protocol = config.get("protocol", "Unknown")
        host = config["host"]
        port = config["port"]

        print(
            f"[{i}/{len(all_configs)}] Testing {protocol} | {host}:{port}...",
            end=" ",
            flush=True,
        )

        latency = test_proxy_latency(config)
        latency_threshold = get_config_value("latency_threshold_ms", 200)

        if latency is not None and latency < latency_threshold:
            config["latency"] = latency
            low_latency_configs.append(config)
            status_msg = f"✅ {protocol} | {host}:{port} - {latency:.2f}ms"
            status_updates.append(status_msg)
            print(f"✅ {latency:.2f}ms")
        else:
            if latency is None:
                fail_msg = f"❌ {protocol} | {host}:{port} - FAILED"
                print("❌ FAILED")
            else:
                latency_threshold = get_config_value("latency_threshold_ms", 200)
                fail_msg = (
                    f"❌ {protocol} | {host}:{port} - {latency:.2f}ms (>{latency_threshold}ms)"
                )
                print(f"❌ {latency:.2f}ms (too high)")
            status_updates.append(fail_msg)

    print(f"\n{'=' * 60}")
    print("TESTING COMPLETE")
    print(f"{'=' * 60}")
    print(f"Total tested: {len(all_configs)}")
    latency_threshold = get_config_value("latency_threshold_ms", 200)
    print(f"Passed (< {latency_threshold}ms): {len(low_latency_configs)}")
    print(f"Failed: {len(all_configs) - len(low_latency_configs)}")
    print(f"{'=' * 60}\n")

    latency_threshold = get_config_value("latency_threshold_ms", 200)
    max_status_updates = 50
    if len(status_updates) > max_status_updates:
        telegram_message = "\n".join(status_updates[:max_status_updates])
        telegram_message += (
            f"\n\n... ({len(status_updates) - max_status_updates} more entries) ...\n"
        )
        telegram_message += "\n".join(status_updates[-10:])
    else:
        telegram_message = "\n".join(status_updates)

    telegram_message += f"\n\n--- RESULTS ---\nFound {len(low_latency_configs)} low-latency configs (< {latency_threshold}ms)."

    result_content = f"--- Low Latency V2Ray/VLESS/VMESS Configs (< {latency_threshold}ms) ---\n\n"
    result_content += f"Total tested: {len(all_configs)}\n"
    result_content += f"Passed: {len(low_latency_configs)}\n"
    result_content += f"Failed: {len(all_configs) - len(low_latency_configs)}\n\n"

    if low_latency_configs:
        low_latency_configs.sort(key=lambda x: x["latency"])

        print("LOW LATENCY CONFIGS:")
        print("-" * 60)
        for config in low_latency_configs:
            result_content += f"Latency: {config['latency']:.2f}ms\n"
            result_content += f"Protocol: {config['protocol']}\n"
            result_content += f"Host: {config['host']}:{config['port']}\n"
            result_content += f"Link: {config['original_link']}\n\n"

            print(
                f"  [{config['latency']:.2f}ms] {config['protocol']} | {config['host']}:{config['port']}"
            )
            print(f"  Link: {config['original_link']}")
            print()
    else:
        result_content += "No configurations passed the latency test.\n"
        print("No configurations passed the latency test.")

    print("=" * 60)

    return telegram_message, result_content, low_latency_configs


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Sends a welcome message and instructions on /start."""
    await update.message.reply_text(
        "👋 *Welcome to V2Ray Config Tester Bot!*\n\n"
        "I help you test and filter V2Ray/VLESS/VMESS configurations from GitHub.\n\n"
        "*Available Commands:*\n"
        "🚀 /start - Show this welcome message\n"
        "▶️ /run - Run config testing and get results\n"
        "⚙️ /config - Configure bot settings\n"
        "📊 /status - View current configuration\n"
        "ℹ️ /help - Show detailed help\n\n"
        "💡 *Tip:* Use the menu button (☰) to see all commands!",
        parse_mode="Markdown",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Shows detailed help message."""
    help_text = (
        "📖 *V2Ray Config Tester Bot - Help*\n\n"
        "*Commands:*\n\n"
        "🚀 `/start` - Show welcome message\n"
        "Shows an introduction and quick command list.\n\n"
        "▶️ `/run` - Run Configuration Testing\n"
        "Fetches configs from GitHub, tests latency, and sends results.\n"
        "Results include working links in copy-ready format.\n\n"
        "⚙️ `/config` - Configure Bot Settings\n"
        "Opens an interactive menu to configure:\n"
        "• GitHub URL\n"
        "• Email settings\n"
        "• Latency threshold\n"
        "• Test timeout\n\n"
        "📊 `/status` - View Current Configuration\n"
        "Shows all current bot settings.\n\n"
        "ℹ️ `/help` - Show this help message\n\n"
        "*How to Use:*\n"
        "1. Configure settings with `/config`\n"
        "2. Run tests with `/run`\n"
        "3. Copy working links from the results\n\n"
        "*Menu Button:*\n"
        "Tap the menu button (☰) next to the text input to see all commands!"
    )

    await update.message.reply_text(help_text, parse_mode="Markdown")


async def config_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Shows configuration menu with inline keyboard."""
    chat_id = update.effective_chat.id
    if str(chat_id) != ADMIN_CHAT_ID:
        await update.message.reply_text("You are not authorized to use this command.")
        return

    keyboard = [
        [
            InlineKeyboardButton("🔗 GitHub URL", callback_data="config_github_url"),
            InlineKeyboardButton("📧 Email Address", callback_data="config_email_address"),
        ],
        [
            InlineKeyboardButton("🔑 Email Password", callback_data="config_email_password"),
            InlineKeyboardButton("📬 Recipient Email", callback_data="config_recipient_email"),
        ],
        [
            InlineKeyboardButton("⚡ Latency Threshold", callback_data="config_latency_threshold"),
            InlineKeyboardButton("⏱️ Test Timeout", callback_data="config_test_timeout"),
        ],
        [InlineKeyboardButton("✅ Done", callback_data="config_done")],
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)

    current_config = (
        f"📋 *Current Configuration:*\n\n"
        f"🔗 GitHub URL: `{get_config_value('github_raw_url', 'Not set')[:50]}...`\n"
        f"📧 Email: `{get_config_value('email_address', 'Not set')}`\n"
        f"📬 Recipient: `{get_config_value('recipient_email', 'Not set')}`\n"
        f"⚡ Latency Threshold: `{get_config_value('latency_threshold_ms', 200)}ms`\n"
        f"⏱️ Test Timeout: `{get_config_value('test_timeout', 5)}s`\n\n"
        f"Select an option to edit:"
    )

    await update.message.reply_text(
        current_config, reply_markup=reply_markup, parse_mode="Markdown"
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Shows current configuration status."""
    chat_id = update.effective_chat.id
    if str(chat_id) != ADMIN_CHAT_ID:
        await update.message.reply_text("You are not authorized to use this command.")
        return

    github_url = get_config_value("github_raw_url", "Not set")
    email_address = get_config_value("email_address", "Not set")
    recipient_email = get_config_value("recipient_email", "Not set")
    latency_threshold = get_config_value("latency_threshold_ms", 200)
    test_timeout = get_config_value("test_timeout", 5)

    status_text = (
        f"📋 *Current Configuration:*\n\n"
        f"🔗 *GitHub URL:*\n`{github_url}`\n\n"
        f"📧 *Email Address:*\n`{email_address}`\n\n"
        f"📬 *Recipient Email:*\n`{recipient_email}`\n\n"
        f"⚡ *Latency Threshold:* `{latency_threshold}ms`\n"
        f"⏱️ *Test Timeout:* `{test_timeout}s`\n\n"
        f"Use /config to edit settings."
    )

    await update.message.reply_text(status_text, parse_mode="Markdown")


async def config_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle configuration menu callbacks."""
    query = update.callback_query
    await query.answer()

    if query.data == "config_done":
        await query.edit_message_text("✅ Configuration menu closed.")
        return ConversationHandler.END

    # Store which config we're editing
    config_key_map = {
        "config_github_url": ("github_raw_url", "GitHub URL", EDITING_GITHUB_URL),
        "config_email_address": (
            "email_address",
            "Email Address",
            EDITING_EMAIL_ADDRESS,
        ),
        "config_email_password": (
            "email_password",
            "Email Password",
            EDITING_EMAIL_PASSWORD,
        ),
        "config_recipient_email": (
            "recipient_email",
            "Recipient Email",
            EDITING_RECIPIENT_EMAIL,
        ),
        "config_latency_threshold": (
            "latency_threshold_ms",
            "Latency Threshold (ms)",
            EDITING_LATENCY_THRESHOLD,
        ),
        "config_test_timeout": (
            "test_timeout",
            "Test Timeout (seconds)",
            EDITING_TEST_TIMEOUT,
        ),
    }

    if query.data in config_key_map:
        key, display_name, state = config_key_map[query.data]
        current_value = get_config_value(key, "")
        context.user_data["editing_key"] = key
        context.user_data["editing_display"] = display_name

        await query.edit_message_text(
            f"✏️ *Editing: {display_name}*\n\n"
            f"Current value: `{current_value}`\n\n"
            f"Please send the new value, or /cancel to abort.",
            parse_mode="Markdown",
        )
        return state

    return ConversationHandler.END


async def receive_config_value(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Receive and save the new configuration value."""
    new_value = update.message.text.strip()
    key = context.user_data.get("editing_key")
    display_name = context.user_data.get("editing_display")

    if not key:
        await update.message.reply_text("❌ Error: No configuration key set.")
        return ConversationHandler.END

    # Validate and convert numeric values
    if key == "latency_threshold_ms":
        try:
            new_value = int(new_value)
            if new_value <= 0:
                await update.message.reply_text("❌ Latency threshold must be a positive number.")
                return EDITING_LATENCY_THRESHOLD
        except ValueError:
            await update.message.reply_text(
                "❌ Please enter a valid number for latency threshold."
            )
            return EDITING_LATENCY_THRESHOLD
    elif key == "test_timeout":
        try:
            new_value = int(new_value)
            if new_value <= 0:
                await update.message.reply_text("❌ Test timeout must be a positive number.")
                return EDITING_TEST_TIMEOUT
        except ValueError:
            await update.message.reply_text("❌ Please enter a valid number for test timeout.")
            return EDITING_TEST_TIMEOUT

    # Save the new value
    app_config[key] = new_value
    save_config()

    await update.message.reply_text(
        f"✅ *{display_name} updated successfully!*\n\n"
        f"New value: `{new_value}`\n\n"
        f"Use /config to edit more settings or /status to view all settings.",
        parse_mode="Markdown",
    )

    # Clear editing state
    context.user_data.pop("editing_key", None)
    context.user_data.pop("editing_display", None)

    return ConversationHandler.END


async def cancel_config(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel configuration editing."""
    context.user_data.pop("editing_key", None)
    context.user_data.pop("editing_display", None)
    await update.message.reply_text("❌ Configuration editing cancelled.")
    return ConversationHandler.END


async def run_test_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Triggers the configuration processing and sends results."""
    chat_id = update.effective_chat.id
    if str(chat_id) != ADMIN_CHAT_ID:
        await update.message.reply_text("You are not authorized to run this command.")
        return

    await update.message.reply_text(
        "🚀 Test initiated. This may take a moment...\nProcessing configs from GitHub..."
    )

    # Run the core logic (this will print to console)
    telegram_summary, result_content, low_latency_configs = process_configs()

    # Send results via Telegram
    await update.message.reply_text("📤 Sending results to Telegram...")
    await send_telegram_results(context, telegram_summary, result_content, low_latency_configs)

    # Send results via Email (optional)
    email_address = get_config_value("email_address", "")
    if email_address and email_address != "your_sender_email@example.com":
        await update.message.reply_text("📧 Attempting to send results via email...")
        email_success = send_email_results(result_content)

        recipient_email = get_config_value("recipient_email", "")
        if email_success:
            await update.message.reply_text(
                f"✅ Results successfully emailed to {recipient_email}."
            )
        else:
            await update.message.reply_text(
                "❌ Failed to send email. Check your SMTP settings and App Password."
            )
    else:
        await update.message.reply_text("ℹ️ Email not configured. Skipping email send.")


def split_message(text: str, max_length: int = 4000) -> List[str]:
    """Split a long message into chunks that fit within Telegram's limit."""
    if len(text) <= max_length:
        return [text]

    chunks = []
    lines = text.split("\n")
    current_chunk = ""

    for line in lines:
        # If adding this line would exceed limit, save current chunk and start new one
        if len(current_chunk) + len(line) + 1 > max_length:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = line + "\n"
        else:
            current_chunk += line + "\n"

    # Add remaining chunk
    if current_chunk:
        chunks.append(current_chunk)

    return chunks


async def send_telegram_results(
    context: ContextTypes.DEFAULT_TYPE,
    summary: str,
    content: str,
    low_latency_configs: List[Dict],
) -> None:
    """Sends the summary, links in monospace format, and the config file to the admin chat."""

    # 1. Send the summary message (split if too long)
    summary_chunks = split_message(summary, max_length=4000)
    for i, chunk in enumerate(summary_chunks):
        if len(summary_chunks) > 1:
            chunk_header = f"📊 Test Results (Part {i + 1}/{len(summary_chunks)}):\n\n"
            chunk = chunk_header + chunk
        try:
            await context.bot.send_message(chat_id=ADMIN_CHAT_ID, text=chunk)
        except Exception as e:
            print(f"Error sending summary message chunk {i + 1}: {e}")
            try:
                plain_chunk = chunk.replace("*", "").replace("_", "").replace("`", "")
                if len(plain_chunk) > 4096:
                    plain_chunk = plain_chunk[:4090] + "..."
                await context.bot.send_message(chat_id=ADMIN_CHAT_ID, text=plain_chunk)
            except Exception as e2:
                print(f"Failed to send even plain text chunk: {e2}")

    if low_latency_configs:
        low_latency_configs_sorted = sorted(low_latency_configs, key=lambda x: x["latency"])

        links_text = "📋 *Working Links (Copy-ready):*\n\n"

        for i, config in enumerate(low_latency_configs_sorted, 1):
            link_entry = f"{i}. `{config['original_link']}`\n"

            if len(links_text) + len(link_entry) > 4000:
                await context.bot.send_message(
                    chat_id=ADMIN_CHAT_ID, text=links_text, parse_mode="Markdown"
                )
                links_text = "📋 *Working Links (continued):*\n\n"

            links_text += link_entry

        if len(links_text) > 30:
            await context.bot.send_message(
                chat_id=ADMIN_CHAT_ID, text=links_text, parse_mode="Markdown"
            )

    if len(content) > 100:
        try:
            from io import BytesIO

            file_data = BytesIO(content.encode("utf-8"))
            file_data.name = "low_latency_configs.txt"

            await context.bot.send_document(
                chat_id=ADMIN_CHAT_ID,
                document=file_data,
                caption="📄 Detailed results file with latency info.",
            )
        except Exception as e:
            print(f"Error sending document: {e}")
            try:
                await context.bot.send_message(
                    chat_id=ADMIN_CHAT_ID, text=f"Could not send results file: {e}"
                )
            except Exception as e2:
                print(f"Failed to send error message: {e2}")


def send_email_results(content: str) -> bool:
    """Sends the filtered configurations via email."""
    try:
        email_subject = get_config_value("email_subject", "V2Ray/VLESS Configs with Low Latency")
        email_address = get_config_value("email_address", "")
        recipient_email = get_config_value("recipient_email", "")
        email_password = get_config_value("email_password", "")
        smtp_server = get_config_value("smtp_server", "smtp.gmail.com")
        smtp_port = get_config_value("smtp_port", 587)

        msg = MIMEText(content)
        msg["Subject"] = email_subject
        msg["From"] = email_address
        msg["To"] = recipient_email

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(email_address, email_password)
            server.sendmail(email_address, recipient_email, msg.as_string())

        return True
    except Exception as e:
        print(f"SMTP Error: Failed to send email: {e}")
        return False


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log the error and send a telegram message to notify the admin."""
    import traceback

    error_msg = f"Exception while handling an update:\n{context.error}"
    print(error_msg)
    traceback.print_exc()

    try:
        if isinstance(update, Update) and update.effective_message:
            error_text = (
                f"⚠️ *Error occurred:*\n\n"
                f"`{str(context.error)[:500]}`\n\n"
                f"Check console for full traceback."
            )
            await context.bot.send_message(
                chat_id=ADMIN_CHAT_ID, text=error_text, parse_mode="Markdown"
            )
        else:
            print("No update object available for error notification")
    except Exception as e:
        print(f"Failed to send error notification: {e}")


def main() -> None:
    """Start the bot."""
    if BOT_TOKEN == "YOUR_TELEGRAM_BOT_TOKEN" or ADMIN_CHAT_ID == "YOUR_ADMIN_CHAT_ID":
        print("Please configure BOT_TOKEN and ADMIN_CHAT_ID in the script before running.")
        return

    print("Starting Telegram Bot...")

    async def post_init(app: Application) -> None:
        """Set up bot commands and menu button after bot is initialized."""
        commands = [
            BotCommand("start", "🚀 Start the bot and see welcome message"),
            BotCommand("run", "▶️ Run config testing and get results"),
            BotCommand("config", "⚙️ Configure bot settings"),
            BotCommand("status", "📊 View current configuration status"),
            BotCommand("help", "ℹ️ Show help and available commands"),
        ]

        await app.bot.set_my_commands(commands)

        try:
            await app.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
            print("✓ Bot commands menu and menu button configured")
        except Exception as e:
            print(f"⚠️  Could not set menu button (may not be supported): {e}")
            print("✓ Bot commands menu configured")

    application = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    application.add_error_handler(error_handler)

    config_conv_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(config_callback, pattern="^config_")],
        states={
            EDITING_GITHUB_URL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_config_value)
            ],
            EDITING_EMAIL_ADDRESS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_config_value)
            ],
            EDITING_EMAIL_PASSWORD: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_config_value)
            ],
            EDITING_RECIPIENT_EMAIL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_config_value)
            ],
            EDITING_LATENCY_THRESHOLD: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_config_value)
            ],
            EDITING_TEST_TIMEOUT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_config_value)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel_config)],
    )

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("run", run_test_command))
    application.add_handler(CommandHandler("config", config_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(config_conv_handler)

    print("Bot is running. Press Ctrl-C to stop.")
    print(f"Configuration file: {CONFIG_FILE.absolute()}")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
