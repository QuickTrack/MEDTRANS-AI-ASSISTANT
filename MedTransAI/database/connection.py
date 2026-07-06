"""Database connection singleton and convenience repository helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from config import AppConfig, CONFIG_PATH
from database import Database


_db: Optional[Database] = None


def get_db() -> Database:
    global _db
    if _db is None:
        cfg = AppConfig.load(CONFIG_PATH)
        cfg.ensure_dirs()
        _db = Database(cfg.db_path())
    return _db
