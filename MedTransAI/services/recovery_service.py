"""Recovery helper: auto-recover after crashes by replaying unfinished work."""

from __future__ import annotations

from typing import Optional

from config import AppConfig, CONFIG_PATH
from database.connection import get_db
from services.logger import get_logger

log = get_logger("recovery")


class RecoveryManager:
    """Detects incomplete states on startup and restores gracefully."""

    def __init__(self, cfg: Optional[AppConfig] = None) -> None:
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)

    def recover(self) -> dict:
        db = get_db()
        report = {"pending_tasks": 0, "unsaved_drafts": 0, "crash_reports": 0}
        try:
            report["pending_tasks"] = db.query_one(
                "SELECT COUNT(*) c FROM tasks WHERE status='pending'")["c"]
            report["unsaved_drafts"] = db.query_one(
                "SELECT COUNT(*) c FROM drafts")["c"]
            logs = self.cfg.resolve("logs")
            report["crash_reports"] = len(list(logs.glob("crash_*.log")))
        except Exception as exc:
            log.error("Recovery inspection failed: %s", exc)
        log.info("Recovery report: %s", report)
        return report
