"""
SQLite database layer with schema definition, migrations and typed access.

Uses a single connection guarded by a lock for thread-safety. Long-running
query jobs run on background workers; the connection is created per-thread
where needed.
"""

from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

from services.logger import get_logger

log = get_logger("db")


SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT UNIQUE,
        project_name TEXT,
        clip_number TEXT,
        duration_seconds REAL,
        speaker TEXT,
        tag TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        content TEXT,
        word_count INTEGER,
        char_count INTEGER,
        confidence REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS exports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        format TEXT,
        path TEXT,
        created_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        jobs_completed INTEGER DEFAULT 0,
        jobs_remaining INTEGER DEFAULT 0,
        success_rate REAL,
        avg_accuracy REAL,
        avg_processing_seconds REAL,
        storage_bytes INTEGER DEFAULT 0
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        action TEXT,
        detail TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        level TEXT,
        message TEXT,
        trace TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """,
]


class Database:
    """Thin, thread-safe wrapper around sqlite3."""

    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        self._write_lock = threading.Lock()
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA foreign_keys=ON;")
            self._local.conn = conn
        return conn

    def _init_schema(self) -> None:
        with self._write_lock:
            conn = self._connect()
            for stmt in SCHEMA_STATEMENTS:
                conn.execute(stmt)
            conn.commit()

    @contextmanager
    def transaction(self):
        conn = self._connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def execute(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Cursor:
        with self._write_lock:
            cur = self._connect().execute(sql, tuple(params))
            self._connect().commit()
            return cur

    def executemany(self, sql: str, seq: Iterable[Iterable[Any]]) -> sqlite3.Cursor:
        with self._write_lock:
            cur = self._connect().executemany(sql, [tuple(s) for s in seq])
            self._connect().commit()
            return cur

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
        cur = self._connect().execute(sql, tuple(params))
        return [dict(row) for row in cur.fetchall()]

    def query_one(self, sql: str, params: Iterable[Any] = ()) -> Optional[dict[str, Any]]:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def insert(self, table: str, data: dict[str, Any]) -> int:
        cols = ", ".join(data.keys())
        placeholders = ", ".join("?" for _ in data)
        sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
        with self._write_lock:
            cur = self._connect().execute(sql, tuple(data.values()))
            self._connect().commit()
            return int(cur.lastrowid)

    def update(self, table: str, data: dict[str, Any], where: str, where_params: Iterable[Any]) -> None:
        sets = ", ".join(f"{k}=?" for k in data)
        sql = f"UPDATE {table} SET {sets} WHERE {where}"
        self.execute(sql, tuple(data.values()) + tuple(where_params))

    def get_setting(self, key: str, default: Optional[str] = None) -> Optional[str]:
        row = self.query_one("SELECT value FROM settings WHERE key=?", (key,))
        return row["value"] if row else default

    def set_setting(self, key: str, value: str) -> None:
        self.execute(
            "INSERT INTO settings(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    def log_activity(self, action: str, detail: str = "") -> None:
        self.insert("activity", {
            "ts": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "detail": detail,
        })

    def log_error(self, level: str, message: str, trace: str = "") -> None:
        self.insert("errors", {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "message": message,
            "trace": trace,
        })

    def close(self) -> None:
        conn = getattr(self._local, "conn", None)
        if conn is not None:
            conn.close()
            self._local.conn = None
