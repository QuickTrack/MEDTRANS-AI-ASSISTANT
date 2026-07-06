"""
Background worker base class built on QThread.

Provides:
  * cancellation support
  * progress signals
  * exception-safe execution (errors forwarded to the UI thread)
  * automatic recovery hooks
"""

from __future__ import annotations

from typing import Any, Optional

from PySide6.QtCore import QThread, Signal

from services.logger import get_logger

log = get_logger("worker")


class Worker(QThread):
    progress = Signal(float)  # 0..1
    finished = Signal(object)
    error = Signal(str)
    message = Signal(str)

    def __init__(self, parent: Optional[Any] = None) -> None:
        super().__init__(parent)
        self._cancelled = False
        self._running = False

    def cancel(self) -> None:
        self._cancelled = True

    def is_cancelled(self) -> bool:
        return self._cancelled

    def run(self) -> None:  # pragma: no cover - executed in thread
        self._running = True
        try:
            result = self.work()
            if not self._cancelled:
                self.finished.emit(result)
        except Exception as exc:
            log.error("Worker error: %s", exc)
            self.error.emit(str(exc))
        finally:
            self._running = False

    def work(self) -> Any:
        raise NotImplementedError
