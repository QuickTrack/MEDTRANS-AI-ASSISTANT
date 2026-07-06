"""Main application window with sidebar navigation, dark mode and auto-update check."""

from __future__ import annotations

import requests
from typing import Optional

from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtWidgets import (
    QWidget, QHBoxLayout, QLabel, QPushButton, QFrame, QStackedWidget,
    QSpacerItem, QSizePolicy, QMessageBox,
)

from config import AppConfig, CONFIG_PATH, APP_VERSION
from services.logger import get_logger
from ui import stylesheet
from ui.dashboard_window import DashboardWindow
from ui.review_window import ReviewWindow
from ui.settings_window import SettingsWindow

log = get_logger("ui.main")


class _UpdateChecker(QThread):
    result = Signal(str)

    def __init__(self, url: str, current: str) -> None:
        super().__init__()
        self.url = url
        self.current = current

    def run(self) -> None:  # pragma: no cover - network
        try:
            if not self.url:
                return
            r = requests.get(self.url, timeout=5)
            data = r.json()
            latest = data.get("version", self.current)
            if latest != self.current:
                self.result.emit(latest)
        except Exception as exc:
            log.debug("Update check skipped: %s", exc)


class MainWindow(QWidget):
    def __init__(self, username: str, cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.username = username
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self.setWindowTitle(self.cfg.name)
        self.resize(1280, 820)
        self.setStyleSheet(stylesheet(self.cfg.theme))
        self._build_ui()
        self._check_update()

    def _build_ui(self) -> None:
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        sidebar = QFrame()
        sidebar.setFixedWidth(220)
        sidebar.setStyleSheet(
            "background-color: #0F172A;" if self.cfg.theme == "dark"
            else "background-color: #1E293B;")
        sb = QVBoxLayout(sidebar)
        sb.setContentsMargins(14, 20, 14, 20)
        sb.setSpacing(8)

        brand = QLabel("MedTrans AI")
        brand.setStyleSheet("color: white; font-size: 18px; font-weight: 700;")
        sb.addWidget(brand)

        self.nav_dash = self._nav_btn("Dashboard", "🏠")
        self.nav_review = self._nav_btn("Review", "📝")
        self.nav_settings = self._nav_btn("Settings", "⚙")
        sb.addWidget(self.nav_dash); sb.addWidget(self.nav_review); sb.addWidget(self.nav_settings)
        sb.addSpacerItem(QSpacerItem(0, 0, QSizePolicy.Minimum, QSizePolicy.Expanding))

        self.theme_btn = QPushButton("Toggle Theme")
        self.theme_btn.clicked.connect(self._toggle_theme)
        self.logout_btn = QPushButton("Logout")
        self.logout_btn.clicked.connect(self._logout)
        sb.addWidget(self.theme_btn); sb.addWidget(self.logout_btn)

        self.stack = QStackedWidget()
        self.dashboard = DashboardWindow(self.username, self.cfg)
        self.review = ReviewWindow(self.username, self.cfg)
        self.settings = SettingsWindow(self.cfg)
        self.stack.addWidget(self.dashboard)
        self.stack.addWidget(self.review)
        self.stack.addWidget(self.settings)

        self.nav_dash.clicked.connect(lambda: self.stack.setCurrentWidget(self.dashboard))
        self.nav_review.clicked.connect(lambda: self.stack.setCurrentWidget(self.review))
        self.nav_settings.clicked.connect(lambda: self.stack.setCurrentWidget(self.settings))

        root.addWidget(sidebar)
        root.addWidget(self.stack, 1)

    def _nav_btn(self, text: str, icon: str) -> QPushButton:
        b = QPushButton(f"{icon}  {text}")
        b.setStyleSheet("color: white; background: transparent; text-align: left; padding: 10px; border-radius: 8px;")
        b.setCursor(Qt.PointingHandCursor)
        return b

    def _toggle_theme(self) -> None:
        self.cfg.theme = "light" if self.cfg.theme == "dark" else "dark"
        self.cfg.save(CONFIG_PATH)
        self.setStyleSheet(stylesheet(self.cfg.theme))
        QMessageBox.information(self, "Theme", "Restart to fully apply theme.")

    def _logout(self) -> None:
        from services.security_service import SecurityService

        SecurityService(self.cfg).clear_session()
        QMessageBox.information(self, "Logout", "Session cleared. Restart application.")

    def _check_update(self) -> None:
        from database.connection import get_db

        url = get_db().get_setting("update_url")
        if not url:
            return
        checker = _UpdateChecker(url, APP_VERSION)
        checker.result.connect(
            lambda v: QMessageBox.information(
                self, "Update", f"New version available: {v} (current {APP_VERSION})"))
        checker.start()
