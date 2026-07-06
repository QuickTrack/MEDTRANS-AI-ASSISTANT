"""
Enterprise logging utility.

Provides a configured root logger with:
  * rotating file handler (logs/app.log)
  * crash report handler (logs/crash_*.log)
  * optional coloured console output (colorlog)

Usage:
    from services.logger import get_logger
    log = get_logger(__name__)
    log.info("message")
"""

from __future__ import annotations

import logging
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import colorlog  # type: ignore
    _HAS_COLORLOG = True
except Exception:  # pragma: no cover
    _HAS_COLORLOG = False

from config import AppConfig, CONFIG_PATH


class CrashReporter:
    """Writes unhandled exceptions to dedicated crash report files."""

    def __init__(self, logs_dir: Path) -> None:
        self.logs_dir = logs_dir
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    def write(self, exc: BaseException) -> Path:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = self.logs_dir / f"crash_{stamp}.log"
        tb = "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        )
        try:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(f"Crash report generated at {datetime.now().isoformat()}\n")
                fh.write(f"Application: {AppConfig().name} v{AppConfig().version}\n")
                fh.write("=" * 60 + "\n")
                fh.write(tb)
        except Exception:
            pass
        return path


_config = AppConfig.load(CONFIG_PATH)
_logs_dir = _config.resolve("logs")
_logs_dir.mkdir(parents=True, exist_ok=True)
_crash_reporter = CrashReporter(_logs_dir)

_LEVEL = getattr(logging, _config.logging.level.upper(), logging.INFO)
_LOGGER_NAME = "medtrans"

_console_format = "%(log_color)s%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"
_file_format = "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"


def _build_logger() -> logging.Logger:
    logger = logging.getLogger(_LOGGER_NAME)
    if logger.handlers:
        return logger
    logger.setLevel(_LEVEL)
    logger.propagate = False

    # File handler with rotation
    from logging.handlers import RotatingFileHandler

    file_handler = RotatingFileHandler(
        _logs_dir / "app.log",
        maxBytes=_config.logging.max_bytes,
        backupCount=_config.logging.backup_count,
        encoding="utf-8",
    )
    file_handler.setFormatter(logging.Formatter(_file_format))
    file_handler.setLevel(_LEVEL)
    logger.addHandler(file_handler)

    # Console handler
    if _HAS_COLORLOG:
        console_handler = colorlog.StreamHandler(sys.stdout)
        console_handler.setFormatter(
            colorlog.ColoredFormatter(
                _console_format,
                datefmt="%H:%M:%S",
                log_colors={
                    "DEBUG": "cyan",
                    "INFO": "green",
                    "WARNING": "yellow",
                    "ERROR": "red",
                    "CRITICAL": "bold_red",
                },
            )
        )
    else:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(logging.Formatter(_file_format))
    console_handler.setLevel(_LEVEL)
    logger.addHandler(console_handler)

    return logger


_ROOT = _build_logger()


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Return a child logger under the medtrans namespace."""
    if name is None:
        return _ROOT
    return _ROOT.getChild(name)


def report_crash(exc: BaseException) -> Path:
    """Record a crash and return the report path."""
    return _crash_reporter.write(exc)


def excepthook(exc_type, exc_value, exc_tb) -> None:  # type: ignore
    """Global excepthook to capture uncaught exceptions."""
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_tb)
        return
    _ROOT.critical("Uncaught exception", exc_info=(exc_type, exc_value, exc_tb))
    report_crash(exc_value)


sys.excepthook = excepthook
