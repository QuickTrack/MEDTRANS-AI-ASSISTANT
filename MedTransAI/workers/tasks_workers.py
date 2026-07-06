"""Concrete workers: transcription, audio processing, export, browser tasks."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Optional

from workers import Worker
from config import AppConfig, CONFIG_PATH
from services.audio_service import AudioService
from services.transcribe_service import TranscribeService, TranscriptionResult
from services.export_service import ExportService
from services.browser_service import BrowserService
from models import Task, Draft


class TranscribeWorker(Worker):
    def __init__(self, audio_path: str | Path, cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.audio_path = str(audio_path)
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self.service = TranscribeService(self.cfg)

    def work(self) -> TranscriptionResult:
        return self.service.transcribe(
            self.audio_path,
            progress_cb=self.progress.emit,
            cancel_cb=self.is_cancelled,
        )


class AudioConvertWorker(Worker):
    def __init__(self, src: str | Path, dst: str | Path, cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.src = str(src)
        self.dst = str(dst)
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)

    def work(self) -> str:
        svc = AudioService(self.cfg)
        out = svc.convert(self.src, self.dst, progress_cb=self.progress.emit)
        return str(out)


class ExportWorker(Worker):
    def __init__(self, task: Optional[Task], draft: Draft, base_name: str,
                 cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.task = task
        self.draft = draft
        self.base_name = base_name
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)

    def work(self) -> list[str]:
        svc = ExportService(self.cfg)
        paths = svc.export_all(self.task, self.draft, self.base_name)
        return [str(p) for p in paths]


class BrowserTaskWorker(Worker):
    def __init__(self, action: Callable[[BrowserService], Any],
                 cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.action = action
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)

    def work(self) -> Any:
        svc = BrowserService(self.cfg)
        try:
            svc.launch()
            return self.action(svc)
        finally:
            svc.close()
