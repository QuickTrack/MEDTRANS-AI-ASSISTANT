"""
Domain models representing business entities used across the application.

These are plain dataclasses (DTOs). Persistence is handled by repositories
in the same module so the model layer stays independent of the UI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from database.connection import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Task:
    id: Optional[int] = None
    external_id: Optional[str] = None
    project_name: Optional[str] = None
    clip_number: Optional[str] = None
    duration_seconds: Optional[float] = None
    speaker: Optional[str] = None
    tag: Optional[str] = None
    status: str = "pending"
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "external_id": self.external_id,
            "project_name": self.project_name,
            "clip_number": self.clip_number,
            "duration_seconds": self.duration_seconds,
            "speaker": self.speaker,
            "tag": self.tag,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class Draft:
    id: Optional[int] = None
    task_id: Optional[int] = None
    content: str = ""
    word_count: int = 0
    char_count: int = 0
    confidence: float = 0.0
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class ExportRecord:
    id: Optional[int] = None
    task_id: Optional[int] = None
    format: str = ""
    path: str = ""
    created_at: str = field(default_factory=_now)


class TaskRepository:
    @staticmethod
    def save(task: Task) -> Task:
        db = get_db()
        data = task.to_dict()
        data.pop("id", None)
        data["updated_at"] = _now()
        if task.id is None:
            task.id = db.insert("tasks", data)
        else:
            db.update("tasks", data, "id=?", (task.id,))
        return task

    @staticmethod
    def get_by_external_id(ext_id: str) -> Optional[Task]:
        row = get_db().query_one("SELECT * FROM tasks WHERE external_id=?", (ext_id,))
        return Task(**row) if row else None

    @staticmethod
    def pending() -> list[Task]:
        rows = get_db().query("SELECT * FROM tasks WHERE status='pending' ORDER BY created_at DESC")
        return [Task(**r) for r in rows]

    @staticmethod
    def all() -> list[Task]:
        rows = get_db().query("SELECT * FROM tasks ORDER BY created_at DESC")
        return [Task(**r) for r in rows]


class DraftRepository:
    @staticmethod
    def save(draft: Draft) -> Draft:
        db = get_db()
        draft.word_count = len(draft.content.split())
        draft.char_count = len(draft.content)
        draft.updated_at = _now()
        data = {
            "task_id": draft.task_id,
            "content": draft.content,
            "word_count": draft.word_count,
            "char_count": draft.char_count,
            "confidence": draft.confidence,
            "created_at": draft.created_at,
            "updated_at": draft.updated_at,
        }
        if draft.id is None:
            draft.id = db.insert("drafts", data)
        else:
            data.pop("id", None)
            data.pop("created_at", None)
            db.update("drafts", data, "id=?", (draft.id,))
        return draft

    @staticmethod
    def get_for_task(task_id: int) -> Optional[Draft]:
        row = get_db().query_one("SELECT * FROM drafts WHERE task_id=?", (task_id,))
        return Draft(**row) if row else None


class ExportRepository:
    @staticmethod
    def save(record: ExportRecord) -> ExportRecord:
        db = get_db()
        rid = db.insert("exports", {
            "task_id": record.task_id,
            "format": record.format,
            "path": record.path,
            "created_at": record.created_at,
        })
        record.id = rid
        return record
