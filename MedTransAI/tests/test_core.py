"""Unit tests for configuration, security, database and controllers (no GUI)."""

from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest

# Qt stub so modules importing PySide6 import cleanly under pytest
_qt_stub = types.ModuleType("PySide6")
for sub in ("QtCore", "QtWidgets", "QtGui", "QtMultimedia"):
    mod = types.ModuleType(f"PySide6.{sub}")
    mod.__path__ = []  # mark as package
    sys.modules[f"PySide6.{sub}"] = mod
sys.modules["PySide6"] = _qt_stub


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    """Provide an isolated app workspace and point the DB + config at it."""
    from config import AppConfig
    import database.connection as dc
    import database as dbmod

    cfg = AppConfig.load(tmp_path / "settings.json")
    cfg.database.file = str(tmp_path / "medtrans.db")
    cfg.ensure_dirs()
    monkeypatch.setattr("config.BASE_DIR", tmp_path)
    monkeypatch.setattr("config.CONFIG_PATH", tmp_path / "settings.json")
    monkeypatch.setattr("services.logger._config", cfg)
    monkeypatch.setattr("services.logger._logs_dir", tmp_path / "logs")
    dc._db = dbmod.Database(tmp_path / "medtrans.db")
    return cfg


def test_config_defaults():
    from config import AppConfig

    cfg = AppConfig()
    assert cfg.ai.model_size == "large-v3"
    assert cfg.theme in ("light", "dark")
    assert ".wav" in cfg.audio.supported_formats


def test_security_roundtrip(workspace, tmp_path):
    from services.security_service import SecurityService

    workspace.security.credentials_file = str(tmp_path / "cred.enc")
    sec = SecurityService(workspace)
    sec.save_credentials("alice", "s3cret")
    assert sec.load_credentials() == ("alice", "s3cret")
    sec.clear_credentials()
    assert sec.load_credentials() is None


def test_security_ciphertext(workspace, tmp_path):
    from services.security_service import SecurityService

    workspace.security.credentials_file = str(tmp_path / "cred.enc")
    sec = SecurityService(workspace)
    sec.save_credentials("bob", "supersecret")
    raw = (tmp_path / "cred.enc").read_bytes()
    assert b"supersecret" not in raw


def test_task_repository(workspace):
    from models import Task, TaskRepository

    t = TaskRepository.save(Task(project_name="P1", clip_number="C1", status="pending"))
    assert t.id is not None
    pending = TaskRepository.pending()
    assert len(pending) == 1
    assert pending[0].project_name == "P1"


def test_draft_repository_counts(workspace):
    from models import Task, TaskRepository, Draft, DraftRepository

    task = TaskRepository.save(Task(project_name="P", status="draft"))
    d = DraftRepository.save(Draft(task_id=task.id, content="one two three", confidence=0.9))
    assert d.word_count == 3
    assert d.char_count == 13


def test_auth_controller_login(workspace):
    from controllers import AuthController

    ctrl = AuthController(cfg=workspace)
    assert ctrl.login("user", "pass", test_login=True) is True


def test_task_controller_from_browser(workspace):
    from controllers import TaskController

    ctrl = TaskController(cfg=workspace)
    task = ctrl.create_from_browser({"project_name": "X", "clip_number": "3", "duration": "12s"})
    assert task.project_name == "X"
    assert task.duration_seconds == 12.0
