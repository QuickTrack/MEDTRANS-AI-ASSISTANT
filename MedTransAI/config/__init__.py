"""
MedTrans AI Assistant - Application configuration.

Centralised, typed configuration loaded from config/settings.json with
sane defaults. All paths are resolved relative to the application base
directory so the executable can be relocated.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

APP_NAME = "MedTrans AI Assistant"
APP_VERSION = "1.0.0"
APP_AUTHOR = "MedTrans AI"
BASE_DIR = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _resolve(path: str) -> Path:
    p = Path(path)
    return p if p.is_absolute() else (BASE_DIR / p)


@dataclass
class DatabaseConfig:
    file: str = "database/medtrans.db"


@dataclass
class PathsConfig:
    logs: str = "logs"
    exports: str = "exports"
    recordings: str = "recordings"
    temp: str = "temp"
    assets: str = "assets"
    resources: str = "resources"


@dataclass
class BrowserConfig:
    headless: bool = False
    persistent_context: bool = True
    context_dir: str = "temp/browser_profile"
    target_url: str = ""  # configured by user / settings
    navigation_timeout_ms: int = 30000
    action_timeout_ms: int = 10000
    max_retries: int = 3


@dataclass
class AudioConfig:
    supported_formats: tuple[str, ...] = (
        ".mp3", ".wav", ".ogg", ".webm", ".m4a", ".aac",
    )
    target_format: str = "wav"
    sample_rate: int = 16000
    normalize: bool = True
    noise_reduction: bool = True
    trim_silence: bool = True
    default_speed: float = 1.0


@dataclass
class AIConfig:
    model_size: str = "large-v3"
    device: str = "auto"  # auto | cpu | cuda
    compute_type: str = "auto"
    beam_size: int = 5
    language: str = "auto"  # auto | fr | en | sw
    use_cuda: bool = True
    cpu_threads: int = 0  # 0 = auto


@dataclass
class ExportConfig:
    folder: str = "exports"
    include_footer: bool = True
    include_page_numbers: bool = True
    hospital_name: str = ""
    logo_path: str = ""
    formats: tuple[str, ...] = ("docx", "pdf", "txt", "json", "csv")


@dataclass
class SecurityConfig:
    credentials_file: str = "config/credentials.enc"
    key_file: str = "config/.key"
    session_file: str = "config/session.json"


@dataclass
class LoggingConfig:
    level: str = "INFO"
    max_bytes: int = 5_000_000
    backup_count: int = 5
    crash_report: bool = True


@dataclass
class AppConfig:
    name: str = APP_NAME
    version: str = APP_VERSION
    base_dir: str = str(BASE_DIR)
    theme: str = "dark"
    language: str = "en"
    auto_login: bool = False
    remember_me: bool = False
    hotkeys: dict[str, str] = field(default_factory=lambda: {
        "play_pause": "Space",
        "save_draft": "Ctrl+S",
        "export": "Ctrl+E",
        "search": "Ctrl+F",
        "undo": "Ctrl+Z",
        "redo": "Ctrl+Shift+Z",
    })
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    paths: PathsConfig = field(default_factory=PathsConfig)
    browser: BrowserConfig = field(default_factory=BrowserConfig)
    audio: AudioConfig = field(default_factory=AudioConfig)
    ai: AIConfig = field(default_factory=AIConfig)
    export: ExportConfig = field(default_factory=ExportConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)

    # resolved path cache
    _cache: dict[str, Path] = field(default_factory=dict, repr=False)

    def resolve(self, key: str) -> Path:
        if key not in self._cache:
            rel = getattr(self.paths, key, key)
            self._cache[key] = _resolve(rel)
        return self._cache[key]

    def ensure_dirs(self) -> None:
        for attr in vars(self.paths):
            p = self.resolve(attr)
            p.mkdir(parents=True, exist_ok=True)
        for extra in ("temp", "config"):
            (_resolve(extra)).mkdir(parents=True, exist_ok=True)

    def db_path(self) -> Path:
        return _resolve(self.database.file)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def save(self, path: str | Path) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_dict(), fh, indent=2)

    @classmethod
    def load(cls, path: str | Path) -> "AppConfig":
        if not Path(path).exists():
            cfg = cls()
            cfg.save(path)
            return cfg
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        cfg = cls()
        _apply(cfg, data)
        return cfg


def _apply(obj: Any, data: dict) -> None:
    for key, value in data.items():
        if not hasattr(obj, key):
            continue
        cur = getattr(obj, key)
        if isinstance(cur, dict) and isinstance(value, dict):
            cur.update(value)
        elif hasattr(cur, "__dataclass_fields__") and isinstance(value, dict):
            _apply(cur, value)
        else:
            setattr(obj, key, value)


CONFIG_PATH = _resolve("config/settings.json")
