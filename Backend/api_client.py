import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from telegram_client import (
    _decode_vmess,
    _parse_other_protocols,
    _parse_vless_v2ray,
    app_config,
    get_and_parse_configs,
    get_config_value,
    save_config,
    test_proxy_latency,
)

app = FastAPI(
    title="V2Ray Config Tester API",
    description="REST API for testing V2Ray/VLESS/VMESS configurations",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "ALLOW_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173",
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = Path("v2ray_results.db")


def init_database():
    """Initialize SQLite database for storing test results.
    Creates tables and indexes for test results and best results.
    """
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS test_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            protocol TEXT NOT NULL,
            host TEXT NOT NULL,
            port TEXT NOT NULL,
            latency_ms REAL,
            original_link TEXT NOT NULL,
            test_url TEXT,
            status TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS best_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            protocol TEXT NOT NULL,
            host TEXT NOT NULL,
            port TEXT NOT NULL,
            latency_ms REAL NOT NULL,
            original_link TEXT NOT NULL UNIQUE,
            first_seen TEXT NOT NULL,
            last_updated TEXT NOT NULL,
            test_count INTEGER DEFAULT 1
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_latency ON best_results(latency_ms)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_protocol ON best_results(protocol)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_timestamp ON test_results(timestamp)
    """)

    conn.commit()
    conn.close()
    print(f"✓ Database initialized: {DB_FILE}")


init_database()


class LinkTestRequest(BaseModel):
    """Request model for testing a single link."""

    link: str
    test_url: Optional[str] = None


class LinkTestResponse(BaseModel):
    """Response model for link test results."""

    success: bool
    link: str
    protocol: Optional[str] = None
    host: Optional[str] = None
    port: Optional[str] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None


class BulkTestRequest(BaseModel):
    """Request model for bulk testing."""

    links: list[str]
    test_url: Optional[str] = None
    save_to_db: bool = True


class BulkTestResponse(BaseModel):
    """Response model for bulk test results."""

    total_tested: int
    successful: int
    failed: int
    results: list[LinkTestResponse]
    best_result: Optional[LinkTestResponse] = None


class BestResult(BaseModel):
    """Model for best results from database."""

    id: int
    protocol: str
    host: str
    port: str
    latency_ms: float
    original_link: str
    first_seen: str
    last_updated: str
    test_count: int


class TestHistory(BaseModel):
    """Model for test history."""

    id: int
    timestamp: str
    protocol: str
    host: str
    port: str
    latency_ms: Optional[float]
    original_link: str
    status: str


class ConfigUpdateRequest(BaseModel):
    """Request model for updating configuration."""

    github_raw_url: Optional[str] = None
    email_address: Optional[str] = None
    email_password: Optional[str] = None
    recipient_email: Optional[str] = None
    latency_threshold_ms: Optional[int] = None
    test_timeout: Optional[int] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    email_subject: Optional[str] = None
    test_url: Optional[str] = None


class ConfigResponse(BaseModel):
    """Response model for configuration."""

    github_raw_url: str
    email_address: str
    email_password: str
    recipient_email: str
    latency_threshold_ms: int
    test_timeout: int
    smtp_server: str
    smtp_port: int
    email_subject: str
    test_url: str


class ConfigKeyUpdateRequest(BaseModel):
    """Request model for updating a single config key."""

    value: Any


def parse_link(link: str) -> dict | None:
    """Parse a VPN link and return config dict."""
    link = link.strip()
    if not link:
        return None

    if link.startswith("vmess://"):
        return _decode_vmess(link)
    elif link.startswith("vless://") or link.startswith("v2ray://"):
        return _parse_vless_v2ray(link)
    elif (
        link.startswith("ss://") or link.startswith("trojan://") or link.startswith("hysteria2://")
    ):
        return _parse_other_protocols(link)

    return None


def save_test_result(
    protocol: str,
    host: str,
    port: str,
    latency_ms: Optional[float],
    original_link: str,
    test_url: str,
    status: str,
):
    """Save a test result to the database."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    timestamp = datetime.now().isoformat()
    cursor.execute(
        """
        INSERT INTO test_results 
        (timestamp, protocol, host, port, latency_ms, original_link, test_url, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (timestamp, protocol, host, port, latency_ms, original_link, test_url, status),
    )

    conn.commit()
    conn.close()


def update_best_results(
    protocol: str,
    host: str,
    port: str,
    latency_ms: float,
    original_link: str,
):
    """Update best results table with the best performing configs."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    now = datetime.now().isoformat()

    cursor.execute(
        "SELECT id, latency_ms, test_count FROM best_results WHERE original_link = ?",
        (original_link,),
    )
    existing = cursor.fetchone()

    if existing:
        existing_id, existing_latency, test_count = existing
        if latency_ms < existing_latency:
            cursor.execute(
                """
                UPDATE best_results 
                SET latency_ms = ?, last_updated = ?, test_count = test_count + 1
                WHERE id = ?
            """,
                (latency_ms, now, existing_id),
            )
        else:
            cursor.execute(
                """
                UPDATE best_results 
                SET test_count = test_count + 1, last_updated = ?
                WHERE id = ?
            """,
                (now, existing_id),
            )
    else:
        cursor.execute(
            """
            INSERT INTO best_results 
            (protocol, host, port, latency_ms, original_link, first_seen, last_updated, test_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """,
            (protocol, host, port, latency_ms, original_link, now, now),
        )

    conn.commit()
    conn.close()


@app.get("/")
async def root() -> dict[str, dict[str, str] | str]:
    """Root endpoint with API information."""
    return {
        "name": "V2Ray Config Tester API",
        "version": "1.0.0",
        "description": "REST API for testing V2Ray/VLESS/VMESS configurations",
        "endpoints": {
            "GET /": "This information page",
            "GET /docs": "Interactive API documentation (Swagger UI)",
            "GET /redoc": "Alternative API documentation (ReDoc)",
            "GET /health": "Health check endpoint",
            "GET /utils": "list available utilities and commands",
            "POST /test/link": "Test a single VPN link",
            "POST /test/bulk": "Test multiple VPN links",
            "POST /test/github": "Test links from configured GitHub URL",
            "GET /results/best": "Get best performing configurations",
            "GET /results/history": "Get test history",
            "GET /results/stats": "Get statistics about tests",
            "DELETE /results/best/{id}": "Delete a best result by ID",
            "GET /config": "Get current configuration",
            "PUT /config": "Update configuration (partial or full)",
            "PUT /config/{key}": "Update a specific configuration key",
        },
    }


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/utils")
async def list_utilities() -> dict[str, Any]:
    """list available utilities and commands."""
    return {
        "utilities": {
            "link_parsing": {
                "description": "Parse and validate VPN configuration links",
                "supported_protocols": [
                    "vmess://",
                    "vless://",
                    "v2ray://",
                    "ss://",
                    "trojan://",
                    "hysteria2://",
                ],
            },
            "latency_testing": {
                "description": "Test proxy latency and connectivity",
                "methods": ["TCP connection test", "HTTP proxy test"],
            },
            "bulk_testing": {
                "description": "Test multiple links simultaneously",
            },
            "github_integration": {
                "description": "Fetch and test links from GitHub repository",
                "current_url": get_config_value("github_raw_url", "Not configured"),
            },
        },
        "commands": {
            "POST /test/link": {
                "description": "Test a single VPN link",
                "request_body": {
                    "link": "string (required) - VPN configuration link",
                    "test_url": "string (optional) - Custom test URL",
                },
                "response": "LinkTestResponse with latency and status",
            },
            "POST /test/bulk": {
                "description": "Test multiple VPN links",
                "request_body": {
                    "links": "array of strings (required) - VPN configuration links",
                    "test_url": "string (optional) - Custom test URL",
                    "save_to_db": "boolean (optional) - Save results to database",
                },
                "response": "BulkTestResponse with all results and best one",
            },
            "POST /test/github": {
                "description": "Fetch and test links from configured GitHub URL",
                "response": "BulkTestResponse with all results",
            },
            "GET /results/best": {
                "description": "Get best performing configurations from database",
                "query_params": {
                    "limit": "integer (optional) - Number of results to return",
                    "protocol": "string (optional) - Filter by protocol",
                    "max_latency": "float (optional) - Maximum latency in ms",
                },
            },
            "GET /results/history": {
                "description": "Get test history from database",
                "query_params": {
                    "limit": "integer (optional) - Number of results to return",
                    "protocol": "string (optional) - Filter by protocol",
                },
            },
            "GET /results/stats": {
                "description": "Get statistics about tests",
            },
        },
        "configuration": {
            "latency_threshold_ms": get_config_value("latency_threshold_ms", 200),
            "test_timeout": get_config_value("test_timeout", 5),
            "test_url": get_config_value("test_url", "http://cp.cloudflare.com/"),
        },
    }


@app.post("/test/link", response_model=LinkTestResponse)
async def test_single_link(request: LinkTestRequest) -> LinkTestResponse:
    """Test a single VPN configuration link."""
    try:
        config = parse_link(request.link)
        if not config:
            return LinkTestResponse(
                success=False,
                link=request.link,
                error="Invalid or unsupported link format",
            )

        latency = test_proxy_latency(config)

        test_url = request.test_url or get_config_value("test_url", "http://cp.cloudflare.com/")
        status = "success" if latency is not None else "failed"

        save_test_result(
            protocol=config["protocol"],
            host=config["host"],
            port=config["port"],
            latency_ms=latency,
            original_link=request.link,
            test_url=test_url,
            status=status,
        )

        if latency is not None:
            update_best_results(
                protocol=config["protocol"],
                host=config["host"],
                port=config["port"],
                latency_ms=latency,
                original_link=request.link,
            )

        return LinkTestResponse(
            success=latency is not None,
            link=request.link,
            protocol=config["protocol"],
            host=config["host"],
            port=config["port"],
            latency_ms=latency,
            error=None if latency is not None else "Connection test failed",
        )
    except Exception as e:
        return LinkTestResponse(
            success=False,
            link=request.link,
            error=str(e),
        )


@app.post("/test/bulk", response_model=BulkTestResponse)
async def test_bulk_links(request: BulkTestRequest) -> BulkTestResponse:
    """Test multiple VPN configuration links."""
    results = []
    successful = 0
    failed = 0
    best_result = None
    best_latency = float("inf")

    for link in request.links:
        test_request = LinkTestRequest(link=link, test_url=request.test_url)
        result = await test_single_link(test_request)
        results.append(result)

        if result.success:
            successful += 1
            if result.latency_ms and result.latency_ms < best_latency:
                best_latency = result.latency_ms
                best_result = result
        else:
            failed += 1

    return BulkTestResponse(
        total_tested=len(request.links),
        successful=successful,
        failed=failed,
        results=results,
        best_result=best_result,
    )


@app.post("/test/github", response_model=BulkTestResponse)
async def test_github_links() -> Any:
    """Fetch and test links from the configured GitHub URL."""
    try:
        all_configs = get_and_parse_configs()

        if not all_configs:
            raise HTTPException(
                status_code=404, detail="No configurations found or failed to fetch"
            )

        links = [config["original_link"] for config in all_configs]
        bulk_request = BulkTestRequest(links=links, save_to_db=True)

        return await test_bulk_links(bulk_request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/best", response_model=list[BestResult])
async def get_best_results(
    limit: int = Query(10, ge=1, le=100, description="Number of results to return"),
    protocol: Optional[str] = Query(None, description="Filter by protocol"),
    max_latency: Optional[float] = Query(None, ge=0, description="Maximum latency in ms"),
) -> list[BestResult]:
    """Get best performing configurations from database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = "SELECT * FROM best_results WHERE 1=1"
    params = []

    if protocol:
        query += " AND protocol = ?"
        params.append(protocol)

    if max_latency is not None:
        query += " AND latency_ms <= ?"
        params.append(max_latency)

    query += " ORDER BY latency_ms ASC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [BestResult(**dict(row)) for row in rows]


@app.get("/results/history", response_model=list[TestHistory])
async def get_test_history(
    limit: int = Query(100, ge=1, le=1000, description="Number of results to return"),
    protocol: Optional[str] = Query(None, description="Filter by protocol"),
) -> list[TestHistory]:
    """Get test history from database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = "SELECT * FROM test_results WHERE 1=1"
    params = []

    if protocol:
        query += " AND protocol = ?"
        params.append(protocol)

    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [TestHistory(**dict(row)) for row in rows]


@app.get("/results/stats")
async def get_statistics() -> dict[str, dict[str, int | float | str] | int | str | float]:
    """Get statistics about tests."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM test_results")
    total_tests = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM test_results WHERE status = 'success'")
    successful_tests = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM test_results WHERE status = 'failed'")
    failed_tests = cursor.fetchone()[0]

    cursor.execute("SELECT AVG(latency_ms) FROM test_results WHERE latency_ms IS NOT NULL")
    avg_latency = cursor.fetchone()[0]

    cursor.execute("SELECT MIN(latency_ms) FROM test_results WHERE latency_ms IS NOT NULL")
    best_latency = cursor.fetchone()[0]

    cursor.execute("""
        SELECT protocol, COUNT(*) as count 
        FROM test_results 
        GROUP BY protocol 
        ORDER BY count DESC
    """)
    protocol_dist = {row[0]: row[1] for row in cursor.fetchall()}

    cursor.execute("SELECT COUNT(*) FROM best_results")
    best_results_count = cursor.fetchone()[0]

    conn.close()

    return {
        "total_tests": total_tests,
        "successful_tests": successful_tests,
        "failed_tests": failed_tests,
        "success_rate": (successful_tests / total_tests * 100) if total_tests > 0 else 0,
        "average_latency_ms": round(avg_latency, 2) if avg_latency else None,
        "best_latency_ms": round(best_latency, 2) if best_latency else None,
        "protocol_distribution": protocol_dist,
        "best_results_count": best_results_count,
    }


@app.delete("/results/best/{result_id}")
async def delete_best_result(result_id: int) -> dict[str, str]:
    """Delete a best result by ID."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM best_results WHERE id = ?", (result_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Result not found")

    cursor.execute("DELETE FROM best_results WHERE id = ?", (result_id,))
    conn.commit()
    conn.close()

    return {"message": f"Result {result_id} deleted successfully"}


@app.get("/config", response_model=ConfigResponse)
async def get_configuration() -> ConfigResponse:
    """Get current configuration."""
    return ConfigResponse(
        github_raw_url=get_config_value("github_raw_url", ""),
        email_address=get_config_value("email_address", ""),
        email_password=get_config_value("email_password", ""),
        recipient_email=get_config_value("recipient_email", ""),
        latency_threshold_ms=get_config_value("latency_threshold_ms", 200),
        test_timeout=get_config_value("test_timeout", 5),
        smtp_server=get_config_value("smtp_server", "smtp.gmail.com"),
        smtp_port=get_config_value("smtp_port", 587),
        email_subject=get_config_value("email_subject", "V2Ray/VLESS Configs with Low Latency"),
        test_url=get_config_value("test_url", "http://cp.cloudflare.com/"),
    )


@app.put("/config", response_model=ConfigResponse)
async def update_configuration(request: ConfigUpdateRequest) -> ConfigResponse:
    """Update configuration. Only provided fields will be updated."""

    if request.github_raw_url is not None:
        app_config["github_raw_url"] = request.github_raw_url
    if request.email_address is not None:
        app_config["email_address"] = request.email_address
    if request.email_password is not None:
        app_config["email_password"] = request.email_password
    if request.recipient_email is not None:
        app_config["recipient_email"] = request.recipient_email
    if request.latency_threshold_ms is not None:
        if request.latency_threshold_ms <= 0:
            raise HTTPException(
                status_code=400, detail="latency_threshold_ms must be a positive number"
            )
        app_config["latency_threshold_ms"] = request.latency_threshold_ms
    if request.test_timeout is not None:
        if request.test_timeout <= 0:
            raise HTTPException(status_code=400, detail="test_timeout must be a positive number")
        app_config["test_timeout"] = request.test_timeout
    if request.smtp_server is not None:
        app_config["smtp_server"] = request.smtp_server
    if request.smtp_port is not None:
        if request.smtp_port <= 0 or request.smtp_port > 65535:
            raise HTTPException(status_code=400, detail="smtp_port must be between 1 and 65535")
        app_config["smtp_port"] = request.smtp_port
    if request.email_subject is not None:
        app_config["email_subject"] = request.email_subject
    if request.test_url is not None:
        app_config["test_url"] = request.test_url

    save_config()

    return ConfigResponse(
        github_raw_url=app_config.get("github_raw_url", ""),
        email_address=app_config.get("email_address", ""),
        email_password=app_config.get("email_password", ""),
        recipient_email=app_config.get("recipient_email", ""),
        latency_threshold_ms=app_config.get("latency_threshold_ms", 200),
        test_timeout=app_config.get("test_timeout", 5),
        smtp_server=app_config.get("smtp_server", "smtp.gmail.com"),
        smtp_port=app_config.get("smtp_port", 587),
        email_subject=app_config.get("email_subject", "V2Ray/VLESS Configs with Low Latency"),
        test_url=app_config.get("test_url", "http://cp.cloudflare.com/"),
    )


@app.put("/config/{key}")
async def update_config_key(key: str, request: ConfigKeyUpdateRequest) -> dict[str, Any]:
    """Update a specific configuration key by name."""

    valid_keys = [
        "github_raw_url",
        "email_address",
        "email_password",
        "recipient_email",
        "latency_threshold_ms",
        "test_timeout",
        "smtp_server",
        "smtp_port",
        "email_subject",
        "test_url",
    ]

    if key not in valid_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid config key. Valid keys: {', '.join(valid_keys)}",
        )

    value = request.value

    if key in ["latency_threshold_ms", "test_timeout"]:
        try:
            value = int(value)
            if value <= 0:
                raise HTTPException(status_code=400, detail=f"{key} must be a positive number")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"{key} must be a valid integer")

    if key == "smtp_port":
        try:
            value = int(value)
            if value <= 0 or value > 65535:
                raise HTTPException(
                    status_code=400, detail="smtp_port must be between 1 and 65535"
                )
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="smtp_port must be a valid integer")

    app_config[key] = value
    save_config()

    return {
        "message": f"Configuration '{key}' updated successfully",
        "key": key,
        "value": value,
        "updated_at": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    print("Starting FastAPI server...")
    print("API Documentation available at:")
    print("  - Swagger UI: http://localhost:8000/docs")
    print("  - ReDoc: http://localhost:8000/redoc")

    uvicorn.run(app, host="0.0.0.0", port=8000)
