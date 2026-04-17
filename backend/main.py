import asyncio
import logging
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import capture, devices, firewall, ips, logs
from app.services import firewall as firewall_service
from app.services import ips as ips_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # Re-apply saved firewall rules on startup
    try:
        await firewall_service.apply_all_rules()
    except Exception:
        logger.warning("Failed to apply firewall rules on startup", exc_info=True)

    # Start the IPS background monitor
    monitor_task = asyncio.create_task(ips_service.monitor_loop())

    yield

    # Graceful shutdown: cancel the IPS monitor
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        logger.info("IPS monitor task cancelled")
    except Exception:
        logger.exception("IPS monitor task raised during shutdown")


app = FastAPI(
    title="IoT Security Gateway",
    description="Virtualized smart router with device monitoring, firewall, and IPS.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router, prefix="/api/devices", tags=["devices"])
app.include_router(capture.router, prefix="/api/packet-capture", tags=["capture"])
app.include_router(firewall.router, prefix="/api/firewall", tags=["firewall"])
app.include_router(ips.router, prefix="/api/ips", tags=["ips"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
