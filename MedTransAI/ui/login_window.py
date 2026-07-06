"""Login window with secure credential storage and remember/session/auto login."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton,
    QCheckBox, QFrame, QSpacerItem, QSizePolicy, QMessageBox,
)

from config import AppConfig, CONFIG_PATH
from services.auth_service import AuthService
from services.security_service import SecurityService
from services.logger import get_logger
from ui import stylesheet

log = get_logger("ui.login")


class LoginWindow(QWidget):
    logged_in = Signal(str)  # username

    def __init__(self, cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self.security = SecurityService(self.cfg)
        self.auth = AuthService(self.security)
        self._build_ui()

    def _build_ui(self) -> None:
        self.setWindowTitle(f"{self.cfg.name} — Login")
        self.setFixedSize(420, 560)
        self.setStyleSheet(stylesheet(self.cfg.theme))

        root = QVBoxLayout(self)
        root.setContentsMargins(32, 32, 32, 32)
        root.setSpacing(14)

        card = QFrame()
        card.setObjectName("card")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(28, 28, 28, 28)
        card_layout.setSpacing(14)

        logo = QLabel("⚕")
        logo.setAlignment(Qt.AlignCenter)
        logo.setStyleSheet("font-size: 48px; color: #2D7FF9;")
        title = QLabel(self.cfg.name)
        title.setObjectName("title")
        title.setAlignment(Qt.AlignCenter)
        sub = QLabel("Authorized users only")
        sub.setAlignment(Qt.AlignCenter)
        sub.setStyleSheet("color: #64748B;")

        self.user = QLineEdit()
        self.user.setPlaceholderText("Username")
        self.pwd = QLineEdit()
        self.pwd.setPlaceholderText("Password")
        self.pwd.setEchoMode(QLineEdit.Password)

        self.remember = QCheckBox("Remember me")
        self.save_session = QCheckBox("Save session")
        self.auto_login = QCheckBox("Auto login")

        self.test_login = QCheckBox("Test login (offline)")

        btn_row = QHBoxLayout()
        self.login_btn = QPushButton("Login")
        self.login_btn.setObjectName("primary")
        self.login_btn.clicked.connect(self._on_login)
        btn_row.addWidget(self.login_btn)

        card_layout.addWidget(logo)
        card_layout.addWidget(title)
        card_layout.addWidget(sub)
        card_layout.addSpacerItem(QSpacerItem(0, 10, QSizePolicy.Minimum, QSizePolicy.Fixed))
        card_layout.addWidget(self.user)
        card_layout.addWidget(self.pwd)
        card_layout.addWidget(self.remember)
        card_layout.addWidget(self.save_session)
        card_layout.addWidget(self.auto_login)
        card_layout.addWidget(self.test_login)
        card_layout.addSpacerItem(QSpacerItem(0, 6, QSizePolicy.Minimum, QSizePolicy.Fixed))
        card_layout.addLayout(btn_row)

        root.addWidget(card)

        # Restore saved credentials
        creds = self.auth.restore()
        if creds and creds[0]:
            self.user.setText(creds[0])
            self.pwd.setText(creds[1] or "")
            self.remember.setChecked(True)

    def _on_login(self) -> None:
        username = self.user.text().strip()
        password = self.pwd.text()
        if not username:
            QMessageBox.warning(self, "Login", "Username is required.")
            return
        try:
            ok = self.auth.login(username, password, test_login=self.test_login.isChecked())
        except Exception as exc:
            log.error("Login failed: %s", exc)
            QMessageBox.critical(self, "Login error", str(exc))
            return

        if not ok:
            QMessageBox.warning(self, "Login failed", "Invalid credentials.")
            return

        if self.remember.isChecked():
            self.auth.remember(username, password)
        else:
            self.security.clear_credentials()
        if self.save_session.isChecked():
            self.security.save_session(username)
        self.cfg.auto_login = self.auto_login.isChecked() and self.remember.isChecked()
        self.cfg.remember_me = self.remember.isChecked()
        self.cfg.save(CONFIG_PATH)

        log.info("User logged in: %s", username)
        self.logged_in.emit(username)
