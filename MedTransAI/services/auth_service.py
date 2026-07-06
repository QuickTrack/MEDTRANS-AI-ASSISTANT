"""Authentication service used by the login controller."""

from __future__ import annotations

from typing import Optional

from services.logger import get_logger
from services.security_service import SecurityService

log = get_logger("auth")


class AuthService:
    """
    Validates user credentials.

    In production this would talk to an identity provider / backend API.
    For the desktop assistant, login is validated against the configured
    website backend via an injected callable, with a local 'test login'
    fallback for offline development.
    """

    def __init__(self, security: SecurityService, verify: Optional[callable] = None) -> None:
        self.security = security
        self._verify = verify

    def login(self, username: str, password: str, test_login: bool = False) -> bool:
        if test_login:
            ok = bool(username)  # offline development mode
            log.info("Test login accepted for user=%s", username)
            return ok
        if self._verify is not None:
            try:
                return bool(self._verify(username, password))
            except Exception as exc:
                log.error("Credential verification failed: %s", exc)
                return False
        # No backend configured: require non-empty credentials (demo only).
        return bool(username and password)

    def remember(self, username: str, password: str) -> None:
        self.security.save_credentials(username, password)

    def restore(self) -> Optional[tuple[str, str]]:
        return self.security.load_credentials()

    def logout(self) -> None:
        self.security.clear_credentials()
        self.security.clear_session()
