"""Application bootstrap: creates QApplication, manages window flow and crash recovery."""

from __future__ import annotations

import sys
from typing import Optional

from PySide6.QtWidgets import QApplication

from config import AppConfig, CONFIG_PATH
from services.logger import get_logger, report_crash
from ui.login_window import LoginWindow
from ui.main_window import MainWindow

log = get_logger("app")


class MedTransApp:
    def __init__(self, argv: list[str]) -> None:
        self.app = QApplication(argv)
        self.cfg = AppConfig.load(CONFIG_PATH)
        self.cfg.ensure_dirs()
        self.login: Optional[LoginWindow] = None
        self.main: Optional[MainWindow] = None

    def _show_login(self) -> None:
        self.login = LoginWindow(self.cfg)
        self.login.logged_in.connect(self._on_logged_in)
        self.login.show()

    def _on_logged_in(self, username: str) -> None:
        if self.login is not None:
            self.login.close()
        self.main = MainWindow(username, self.cfg)
        self.main.show()

    def run(self) -> int:
        try:
            self._show_login()
            return self.app.exec()
        except Exception as exc:  # pragma: no cover
            log.critical("Fatal error: %s", exc)
            report_crash(exc)
            return 1


def main() -> int:
    return MedTransApp(sys.argv).run()


if __name__ == "__main__":
    sys.exit(main())
