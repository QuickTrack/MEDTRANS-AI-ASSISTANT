"""
Security service: encrypted credential storage and session management.

Uses the `cryptography` Fernet scheme. The symmetric key is derived from a
device-stable machine identifier and stored in a protected key file. Plain
text passwords are never persisted; only ciphertext is written to disk.
"""

from __future__ import annotations

import base64
import json
import platform
import uuid
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from config import AppConfig, CONFIG_PATH
from services.logger import get_logger

log = get_logger("security")


class SecurityService:
    """Handles encryption of stored credentials and session persistence."""

    def __init__(self, cfg: Optional[AppConfig] = None) -> None:
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self._key: Optional[bytes] = None
        self._machine_seed = self._read_machine_seed()

    # ----- key management -----
    def _read_machine_seed(self) -> str:
        try:
            seed = self.cfg.resolve("temp") / ".machine_seed"
            if seed.exists():
                return seed.read_text(encoding="utf-8").strip()
        except Exception:
            pass
        mac = uuid.getnode()
        raw = f"{platform.node()}-{mac}-{platform.system()}"
        try:
            seed = self.cfg.resolve("temp") / ".machine_seed"
            seed.write_text(raw, encoding="utf-8")
        except Exception:
            pass
        return raw

    def _derive_key(self) -> bytes:
        if self._key is None:
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b"medtrans-ai-salt",
                info=self._machine_seed.encode(),
            )
            self._key = base64.urlsafe_b64encode(hkdf.derive(b"medtrans-ai-assistant"))
        return self._key

    def _fernet(self) -> Fernet:
        return Fernet(self._derive_key())

    # ----- credential storage -----
    def save_credentials(self, username: str, password: str) -> None:
        data = json.dumps({"username": username, "password": password}).encode("utf-8")
        token = self._fernet().encrypt(data)
        path = self.cfg.resolve("temp").parent / self.cfg.security.credentials_file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(token)
        log.info("Credentials securely stored (encrypted).")

    def load_credentials(self) -> Optional[tuple[str, str]]:
        path = self.cfg.resolve("temp").parent / self.cfg.security.credentials_file
        if not path.exists():
            return None
        try:
            token = path.read_bytes()
            data = self._fernet().decrypt(token)
            obj = json.loads(data.decode("utf-8"))
            return obj.get("username"), obj.get("password")
        except Exception as exc:  # pragma: no cover
            log.warning("Failed to decrypt saved credentials: %s", exc)
            return None

    def clear_credentials(self) -> None:
        path = self.cfg.resolve("temp").parent / self.cfg.security.credentials_file
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass

    # ----- session -----
    def save_session(self, username: str) -> None:
        path = self.cfg.resolve("temp").parent / self.cfg.security.session_file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"username": username, "ts": _now_iso()}), encoding="utf-8")

    def load_session(self) -> Optional[str]:
        path = self.cfg.resolve("temp").parent / self.cfg.security.session_file
        if not path.exists():
            return None
        try:
            obj = json.loads(path.read_text(encoding="utf-8"))
            return obj.get("username")
        except Exception:
            return None

    def clear_session(self) -> None:
        path = self.cfg.resolve("temp").parent / self.cfg.security.session_file
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
