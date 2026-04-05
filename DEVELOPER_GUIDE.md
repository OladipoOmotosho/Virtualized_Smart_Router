# Developer Guide

> Complete setup and development guide for the IoT Security Gateway.  
> Covers **Windows**, **macOS**, and **Linux**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Repository Setup](#repository-setup)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Running the Application](#running-the-application)
6. [CentOS VM & Network Simulation](#centos-vm--network-simulation)
7. [API Reference](#api-reference)
8. [Testing](#testing)
9. [Production Build & Deployment](#production-build--deployment)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Ensure you have the following installed before proceeding:

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.11 or higher | [python.org](https://www.python.org/downloads/) |
| Node.js | 18 or higher | [nodejs.org](https://nodejs.org/) |
| Yarn | 1.22+ | [yarnpkg.com](https://classic.yarnpkg.com/en/docs/install) |
| Git | Latest | [git-scm.com](https://git-scm.com/) |

### Verify installations

```bash
python --version    # or python3 --version
node --version
yarn --version
git --version
```

---

## Repository Setup

```bash
git clone https://github.com/OladipoOmotosho/Virtualized_Smart_Router.git
cd Virtualized_Smart_Router
```

---

## Backend Setup

The backend is a Python FastAPI application located in the `backend/` directory.

### 1. Create a virtual environment

**Windows (PowerShell):**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
```

**macOS / Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

> You should see `(venv)` appear in your terminal prompt.

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy the example environment file and update it with your values:

**Windows (PowerShell):**
```powershell
Copy-Item ..\\.env.example -Destination ..\\.env
```

**macOS / Linux:**
```bash
cp ../.env.example ../.env
```

Open `.env` and fill in your SMTP credentials if you want email alerts:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TIMEOUT=10
ALERT_RECIPIENT=admin@example.com

DB_PATH=gateway.db
PCAP_DIR=pcaps

LOG_RETENTION_DAYS=30
IPS_POLL_INTERVAL=5
```

> **Note:** For Gmail, you need to generate an [App Password](https://support.google.com/accounts/answer/185833). Regular passwords will not work.

### 4. Start the backend server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify the server is running:
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

Or open [http://localhost:8000/health](http://localhost:8000/health) in your browser.

> The SQLite database (`gateway.db`) is auto-created on first startup.

---

## Frontend Setup

The frontend is a React + TypeScript application located in the `frontend/` directory.

### 1. Install dependencies

```bash
cd frontend
yarn install
```

### 2. Start the development server

```bash
yarn dev
```

The dashboard opens at [http://localhost:5173](http://localhost:5173).

> The Vite dev server automatically proxies `/api` requests to `http://localhost:8000`, so both servers must be running.

---

## Running the Application

You need **two terminals** running simultaneously during development.

### Terminal 1 — Backend

**Windows (PowerShell):**
```powershell
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**macOS / Linux:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2 — Frontend

```bash
cd frontend
yarn dev
```

### Access the dashboard

Open [http://localhost:5173](http://localhost:5173) in your browser.

| Page | URL | Description |
|------|-----|-------------|
| Devices | `/` | View and manage discovered IoT devices |
| Capture | `/capture` | Start/stop packet captures, manage pcap files |
| Firewall | `/firewall` | Configure whitelist firewall rules |
| IPS | `/ips` | Monitor intrusion detection alerts |
| Logs | `/logs` | Traffic graphs and system activity logs |

---

## CentOS VM & Network Simulation

The full feature set (device discovery, packet capture, firewall enforcement, IPS) requires a **CentOS 9 VM** with Linux networking tools.

### VM Prerequisites

Install these on the CentOS VM:
```bash
sudo dnf install -y tcpdump iptables bridge-utils iproute
```

### Create simulated IoT devices

The script creates 3 network namespaces that simulate IoT devices:

```bash
sudo bash scripts/setup-namespaces.sh
```

This creates:

| Namespace | IP Address | Interface |
|-----------|-----------|-----------|
| ns1 | 10.0.0.2 | veth1 |
| ns2 | 10.0.0.3 | veth2 |
| ns3 | 10.0.0.4 | veth3 |

### Verify the setup

```bash
# List namespaces
ip netns list

# Test connectivity
ping -c 3 10.0.0.2

# Test outbound from a simulated device
ip netns exec ns1 ping -c 3 8.8.8.8

# Check ARP table (used by device discovery)
cat /proc/net/arp
```

### Reset iptables (development only)

To clear all firewall rules and return to a default-open state:
```bash
sudo bash scripts/reset-iptables.sh
```

> **Warning:** This removes all firewall enforcement. Only use on the development VM.

### Remote development via SSH

You can develop on your local machine while the backend runs on the VM:

```bash
# Forward the backend port to your local machine
ssh -L 8000:localhost:8000 user@your-vm-ip
```

Then run the frontend locally with `yarn dev` — it will proxy to the VM's backend.

---

## API Reference

The backend exposes a REST API at `http://localhost:8000/api/`.

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Returns `{"status": "ok"}` |

### Devices
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/devices/` | List all discovered devices |
| `POST` | `/api/devices/scan` | Trigger a network scan |
| `PATCH` | `/api/devices/{id}` | Update device metadata (name, model, etc.) |

### Packet Capture
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/packet-capture/start` | Start capture for one or more devices |
| `POST` | `/api/packet-capture/stop` | Stop an active capture session |
| `GET` | `/api/packet-capture/files` | List saved .pcap files |
| `DELETE` | `/api/packet-capture/files/{name}` | Delete a pcap file |

### Firewall
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/firewall/rules` | List all whitelist rules |
| `POST` | `/api/firewall/rules` | Add a new whitelist rule |
| `DELETE` | `/api/firewall/rules/{id}` | Delete a rule |
| `POST` | `/api/firewall/apply` | Apply all rules to iptables |

### IPS
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ips/status` | IPS monitoring status and thresholds |
| `GET` | `/api/ips/alerts` | List IPS anomaly alerts |

### Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/logs/traffic?days=7&device_id=1` | Traffic rate history |
| `GET` | `/api/logs/system?page=1&limit=20` | Paginated system logs |
| `DELETE` | `/api/logs/purge` | Delete old log records |

> Interactive API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI).

---

## Testing

### Backend tests

```bash
cd backend
```

**Windows (PowerShell):**
```powershell
.\venv\Scripts\activate
pytest
```

**macOS / Linux:**
```bash
source venv/bin/activate
pytest
```

All tests use mocked system commands — no root access or Linux VM required.

### Frontend type checking

```bash
cd frontend
yarn typecheck
```

### Linting

**Backend (Ruff):**
```bash
cd backend
ruff check .
ruff format --check .
```

**Frontend (ESLint + Prettier):**
```bash
cd frontend
yarn lint
yarn format
```

---

## Production Build & Deployment

### Build the frontend

```bash
cd frontend
yarn build
```

This outputs optimized static files to `frontend/dist/`.

### Serve from the VM

Option A — Use a reverse proxy (recommended):
```bash
# Install nginx
sudo dnf install -y nginx

# Copy built files
sudo cp -r frontend/dist/* /usr/share/nginx/html/

# Configure nginx to proxy /api to the backend
# Add to /etc/nginx/conf.d/gateway.conf:
# location /api/ { proxy_pass http://127.0.0.1:8000; }
```

Option B — Serve static files from FastAPI directly (simpler):
```python
# Add to main.py:
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")
```

### Run the backend in production

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

> Use `--workers 1` because the IPS monitor uses in-memory state that isn't shared across workers.

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'aiosqlite'`
You're running with the system Python instead of the virtual environment.  
**Fix:** Activate the venv first:
- Windows: `.\venv\Scripts\activate`
- macOS/Linux: `source venv/bin/activate`

### `/proc/net/arp not found` warning
Expected on Windows and macOS. Device discovery and IPS monitoring require Linux.  
The backend will still start — these features just won't return data.

### Frontend shows "Failed to load devices"
The backend isn't running or the proxy isn't configured.  
**Fix:** Ensure the backend is running on port 8000 and the Vite dev server is started.

### `iptables: command not found`
Firewall features require Linux with iptables installed.  
**Fix:** `sudo dnf install -y iptables` (CentOS) or `sudo apt install -y iptables` (Ubuntu).

### `tcpdump: permission denied`
Packet capture requires root privileges.  
**Fix:** Run the backend with `sudo` or grant `CAP_NET_RAW`:
```bash
sudo setcap cap_net_raw+ep $(which tcpdump)
```

### Port 8000 or 5173 already in use
**Fix:** Kill the existing process or use a different port:
```bash
# Backend
uvicorn main:app --reload --port 8001

# Frontend (in vite.config.ts, change server.port)
```

### SMTP email alerts not sending
Gmail requires an App Password, not your regular password.  
**Fix:** Go to [Google Account → App Passwords](https://myaccount.google.com/apppasswords), generate one, and put it in `.env`.

---

## Project Structure

```
Virtualized_Smart_Router/
├── backend/
│   ├── main.py                 # FastAPI entrypoint
│   ├── requirements.txt        # Python dependencies
│   ├── app/
│   │   ├── config.py           # Environment settings
│   │   ├── database.py         # SQLite schema & connection
│   │   ├── routes/             # API endpoint handlers
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # Business logic
│   │   └── utils/              # Shell & email helpers
│   └── tests/                  # pytest test suite
├── frontend/
│   ├── package.json            # Node dependencies
│   ├── vite.config.ts          # Vite + proxy config
│   └── src/
│       ├── App.tsx             # Root component + routing
│       ├── pages/              # Route-level page components
│       ├── hooks/              # Custom React hooks
│       ├── components/ui/      # Reusable UI components
│       ├── lib/                # API client & utilities
│       └── types/              # TypeScript interfaces
├── scripts/
│   ├── setup-namespaces.sh     # Create simulated IoT devices
│   └── reset-iptables.sh      # Clear all firewall rules
├── .env.example                # Environment variable template
├── DEVELOPER_GUIDE.md          # This file
└── README.md                   # Project overview
```
