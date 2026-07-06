"""Backwards-compatible alias for the enterprise logger module."""

from services.logger import get_logger, report_crash, excepthook, CrashReporter

__all__ = ["get_logger", "report_crash", "excepthook", "CrashReporter"]
