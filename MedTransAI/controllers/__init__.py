"""
Controllers orchestrate flows between UI, services and models (MVC).

Each controller is a thin coordinator injected with its dependencies so it
can be unit-tested without a running GUI.
"""

from __future__ import annotations

from typing import Optional

from config import AppConfig, CONFIG_PATH
from services.auth_service import AuthService
from services.security_service import SecurityService
from models import Task, TaskRepository, Draft, DraftRepository
from services.logger import get_logger

log = get_logger("controller.auth")


class AuthController:
    def __init__(self, auth: Optional[AuthService] = None, cfg: Optional[AppConfig] = None) -> None:
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self.auth = auth or AuthService(SecurityService(self.cfg))

    def login(self, username: str, password: str, test_login: bool = False,
              remember: bool = False, save_session: bool = False) -> bool:
        ok = self.auth.login(username, password, test_login=test_login)
        if ok:
            if remember:
                self.auth.remember(username, password)
            if save_session:
                self.auth.security.save_session(username)
        return ok

    def auto_login_available(self) -> bool:
        return self.cfg.auto_login and self.auth.restore() is not None

    def restore(self) -> Optional[tuple[str, str]]:
        return self.auth.restore()

    def logout(self) -> None:
        self.auth.logout()


class TaskController:
    def __init__(self, cfg: Optional[AppConfig] = None) -> None:
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)

    def create_from_browser(self, info: dict) -> Task:
        task = Task(
            project_name=info.get("project_name"),
            clip_number=info.get("clip_number"),
            duration_seconds=_to_float(info.get("duration")),
            speaker=info.get("speaker"),
            tag=info.get("tag"),
            status="pending",
        )
        return TaskRepository.save(task)

    def save_draft(self, task: Optional[Task], content: str, confidence: float = 0.0) -> Draft:
        if task is None:
            task = TaskRepository.save(Task(project_name="Imported", status="draft"))
        draft = Draft(task_id=task.id, content=content, confidence=confidence)
        return DraftRepository.save(draft)


def _to_float(value) -> Optional[float]:
    try:
        return float(str(value).replace("s", "").strip())
    except Exception:
        return None
