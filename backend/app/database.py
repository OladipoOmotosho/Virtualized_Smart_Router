import aiosqlite

from app.config import settings

DB_PATH = settings.db_path


async def _connect_db() -> aiosqlite.Connection:
    conn = await aiosqlite.connect(DB_PATH)
    await conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = aiosqlite.Row
    return conn

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS devices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    mac         TEXT    NOT NULL UNIQUE,
    ip          TEXT    NOT NULL,
    name        TEXT,
    model       TEXT,
    version     TEXT,
    description TEXT,
    vendor      TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS firewall_rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  INTEGER NOT NULL,
    dest_ip    TEXT    NOT NULL,
    dest_port  INTEGER,
    protocol   TEXT    NOT NULL DEFAULT 'tcp',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS capture_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  INTEGER NOT NULL,
    pcap_file  TEXT    NOT NULL,
    pid        INTEGER,
    started_at TEXT    NOT NULL DEFAULT (datetime('now')),
    stopped_at TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS traffic_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   INTEGER NOT NULL,
    rate_kbps   REAL    NOT NULL,
    recorded_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ips_alerts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id      INTEGER NOT NULL,
    measured_rate  REAL    NOT NULL,
    threshold      REAL    NOT NULL,
    triggered_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
"""


async def get_db() -> aiosqlite.Connection:
    """Open and return a database connection with row_factory set."""
    return await _connect_db()


async def init_db() -> None:
    """Create all tables on startup if they do not already exist."""
    async with await _connect_db() as db:
        await db.executescript(_CREATE_TABLES)
        await db.commit()
