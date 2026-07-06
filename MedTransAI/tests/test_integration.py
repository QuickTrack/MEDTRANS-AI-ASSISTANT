"""Integration-flavoured test: full flow with stubbed external binaries.

Verifies the controller → model → repository path end-to-end without
requiring FFmpeg, CUDA or a display. External services that need real
binaries are instantiated but their side-effecting methods are not invoked.
"""

from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest

# Qt + heavy native stubs for import-time safety under pytest
_qt = types.ModuleType("PySide6")
for sub in ("QtCore", "QtWidgets", "QtGui", "QtMultimedia"):
    m = types.ModuleType(f"PySide6.{sub}")
    m.__path__ = []
    sys.modules[f"PySide6.{sub}"] = m
sys.modules["PySide6"] = _qt


@pytest.fixture
def cfg(tmp_path, monkeypatch):
    from config import AppConfig
    import database.connection as dc
    import database as dbmod

    c = AppConfig.load(tmp_path / "settings.json")
    c.database.file = str(tmp_path / "m.db")
    c.ensure_dirs()
    monkeypatch.setattr("config.BASE_DIR", tmp_path)
    monkeypatch.setattr("config.CONFIG_PATH", tmp_path / "settings.json")
    monkeypatch.setattr("services.logger._config", c)
    monkeypatch.setattr("services.logger._logs_dir", tmp_path / "logs")
    dc._db = dbmod.Database(tmp_path / "m.db")
    return c


def test_full_review_flow(cfg):
    from controllers import TaskController
    from models import DraftRepository

    ctrl = TaskController(cfg=cfg)
    task = ctrl.create_from_browser({
        "project_name": "Cardiology", "clip_number": "12",
        "duration": "45s", "speaker": "Dr. X", "tag": "consult",
    })
    draft = ctrl.save_draft(task, "Patient presents with chest pain.", confidence=0.95)
    stored = DraftRepository.get_for_task(task.id)
    assert stored is not None
    assert stored.content == "Patient presents with chest pain."
    assert stored.confidence == 0.95


def test_services_instantiate(cfg):
    from services.audio_service import AudioService
    from services.transcribe_service import TranscribeService
    from services.export_service import ExportService
    from services.recovery_service import RecoveryManager

    assert AudioService(cfg).ffmpeg
    assert TranscribeService(cfg)._resolve_device()[0] in ("cpu", "cuda", "auto")
    assert ExportService(cfg)
    rep = RecoveryManager(cfg).recover()
    assert "pending_tasks" in rep
