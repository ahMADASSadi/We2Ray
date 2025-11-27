# V2Ray Config Tester

Telegram-assisted V2Ray/VLESS configuration tester with a FastAPI backend and a React/Vite frontend.  
The backend exposes REST endpoints that fetch, validate and time configuration links, persists the best results in SQLite, and drives a Telegram bot for interactive control.  
The frontend (React + Tailwind) surfaces bulk testing, best-result dashboards, history and configuration editing.

---

## Contents

- [V2Ray Config Tester](#v2ray-config-tester)
  - [Contents](#contents)
  - [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
    - [Backend API](#backend-api)
    - [Telegram Bot](#telegram-bot)
    - [Frontend](#frontend)
  - [Environment Variables](#environment-variables)
  - [Docker Workflow](#docker-workflow)
  - [Key API Endpoints](#key-api-endpoints)
  - [Troubleshooting](#troubleshooting)

---

## Architecture

- **Backend (`Backend/`)**
  - FastAPI application (`api_client.py`) serving `/test`, `/results`, `/config`, and `/utils` endpoints.
  - Telegram worker (`telegram_client.py`) that receives commands, runs tests, and emails results.
  - Shared SQLite database `v2ray_results.db` plus JSON config file (`config.json`).
  - Dependency management via `pyproject.toml` + `uv.lock` (managed with [Astral's `uv`](https://github.com/astral-sh/uv)).

- **Frontend (`Frontend/`)**
  - React 19 + Vite + TypeScript + Tailwind UI.
  - Axios client at `src/api/client.ts` calls the backend; `VITE_API_URL` controls the base URL at build time.

- **Docker**
  - Single backend image used by both API and bot containers.
  - Frontend is built and served by nginx.
  - `docker-compose.yaml` wires everything together with shared volumes for `config.json` and `v2ray_results.db`.

---

## Project Structure

``` sh
v2raybot/
├── Backend/
│   ├── api_client.py          # FastAPI service
│   ├── telegram_client.py     # Telegram bot worker
│   ├── config.json            # Runtime config (mounted into containers)
│   ├── v2ray_results.db       # SQLite database
│   ├── pyproject.toml / uv.lock
│   └── Dockerfile
├── Frontend/
│   ├── src/                   # React application
│   ├── package.json / lockfile
│   └── Dockerfile
├── docker-compose.yaml
└── README.md
```

---

## Prerequisites

- **Backend**
  - Python 3.12
  - [`uv`](https://github.com/astral-sh/uv) (`pip install uv` or `pipx install uv`)

- **Frontend**
  - Node.js 20+
  - npm 10+

- **Docker (optional)**
  - Docker Engine 24+
  - Docker Compose v2 (`docker compose`)

---

## Local Development

### Backend API

```bash
cd Backend
uv sync                               # creates .venv using uv.lock
source .venv/bin/activate
export BOT_TOKEN=... ADMIN_CHAT_ID=...  # see environment table below
uvicorn api_client:app --reload --host 0.0.0.0 --port 8000
```

The API documentation is available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Telegram Bot

Uses the same virtual environment as the API:

```bash
cd Backend
source .venv/bin/activate
python telegram_client.py
```

### Frontend

```bash
cd Frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

By default Vite serves on <http://localhost:3000> and proxies `/api/*` to the backend (see `vite.config.ts`).

---

## Environment Variables

| Variable        | Location     | Description |
|----------------|--------------|-------------|
| `BOT_TOKEN`    | Backend/Bot  | Telegram bot token from BotFather. Required for both API (webhooks) and Telegram worker. |
| `ADMIN_CHAT_ID`| Backend/Bot  | Telegram chat ID receiving privileged notifications. |
| `TZ`           | Backend      | Optional timezone. Defaults to `UTC` in docker-compose. |
| `VITE_API_URL` | Frontend     | Base URL for Axios calls. Set to the externally reachable backend URL (e.g. `http://localhost:8000`). |

Additional configuration values (SMTP credentials, GitHub link source, timeouts, etc.) live in `Backend/config.json` and are exposed through `/config` endpoints and the Configuration UI.

---

## Docker Workflow

1. Create a `.env` next to `docker-compose.yaml`:

   ```env
   BOT_TOKEN=123456789:abcdef
   ADMIN_CHAT_ID=1234567890
   TZ=UTC
   VITE_API_URL=http://localhost:8000
   ```

2. Build and start everything:

   ```bash
   docker compose up -d --build
   ```

   - `backend` exposes FastAPI on `localhost:8000`.
   - `bot` runs `telegram_client.py`.
   - `frontend` serves the static React bundle on `http://localhost:4173`.

3. Logs & lifecycle:

   ```bash
   docker compose logs -f backend
   docker compose logs -f bot
   docker compose down
   ```

**Volume notes:** `config.json` and `v2ray_results.db` are bind-mounted, so local edits persist across container rebuilds.

---

## Key API Endpoints

| Method | Path                | Description |
|--------|--------------------|-------------|
| `GET`  | `/`                | Basic welcome payload. |
| `GET`  | `/health`          | Lightweight health probe. |
| `GET`  | `/utils`           | Returns utility metadata and commands. |
| `POST` | `/test/link`       | Test a single V2Ray/VLESS/Trojan/etc. link. |
| `POST` | `/test/bulk`       | Submit multiple links for latency testing. |
| `POST` | `/test/github`     | Pulls links from the configured GitHub source and tests them. |
| `GET`  | `/results/best`    | Persisted best-performing links. |
| `GET`  | `/results/history` | Historical test runs. |
| `GET`  | `/results/stats`   | Aggregated statistics. |
| `DELETE` | `/results/best/{id}` | Remove a stored best result. |
| `GET`  | `/config`          | Current configuration (matches `config.json`). |
| `PUT`  | `/config`          | Bulk update configuration fields. |
| `PUT`  | `/config/{key}`    | Update a single configuration attribute. |

All responses are typed in `Frontend/src/api/client.ts`, which can be used as reference for request/response shapes.

---

## Troubleshooting

- **Frontend calls fail with `backend-api` hostname**  
  The compiled frontend hardcodes `VITE_API_URL`. When running outside Docker, set `VITE_API_URL=http://localhost:8000` before `npm run dev` or `docker compose build frontend`.

- **Missing Python dependencies in Docker**  
  The backend image installs dependencies with `uv sync`. If you add packages to `pyproject.toml`, regenerate `uv.lock` (`uv pip compile` / `uv sync`) and rebuild the image: `docker compose build backend bot`.

- **Config/DB changes not persisting**  
  Ensure the bind mounts in `docker-compose.yaml` point to `./Backend/config.json` and `./Backend/v2ray_results.db`. These files live on the host, so container restarts retain data.

- **Telegram bot permissions**  
  Double-check `BOT_TOKEN`, `ADMIN_CHAT_ID`, and that the bot has access to the chats/groups you expect.

---

Happy testing! Contributions and issue reports are always welcome. Feel free to open pull requests for additional providers, UI polish, or deployment guides.
