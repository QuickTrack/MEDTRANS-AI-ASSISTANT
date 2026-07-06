"""Settings window: theme, language, model, GPU/CPU, hotkeys, audio speed, logging, backup."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QComboBox, QPushButton,
    QFrame, QCheckBox, QLineEdit, QFileDialog, QSpacerItem, QSizePolicy, QMessageBox,
)

from config import AppConfig, CONFIG_PATH
from services.logger import get_logger
from ui import stylesheet

log = get_logger("ui.settings")


class SettingsWindow(QWidget):
    def __init__(self, cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self.setWindowTitle(f"{self.cfg.name} — Settings")
        self.resize(560, 660)
        self.setStyleSheet(stylesheet(self.cfg.theme))
        self._build_ui()

    def _row(self, label: str, widget) -> QHBoxLayout:
        row = QHBoxLayout()
        row.addWidget(QLabel(label))
        row.addSpacerItem(QSpacerItem(0, 0, QSizePolicy.Expanding, QSizePolicy.Minimum))
        row.addWidget(widget)
        return row

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 24, 24, 24)
        root.setSpacing(14)

        card = QFrame(); card.setObjectName("card")
        c = QVBoxLayout(card)
        c.setContentsMargins(20, 20, 20, 20)
        c.setSpacing(12)

        self.theme = QComboBox(); self.theme.addItems(["light", "dark"])
        self.theme.setCurrentText(self.cfg.theme)
        self.lang = QComboBox(); self.lang.addItems(["en", "fr", "sw"])
        self.lang.setCurrentText(self.cfg.language)
        self.model = QComboBox(); self.model.addItems(["tiny", "base", "small", "medium", "large-v3"])
        self.model.setCurrentText(self.cfg.ai.model_size)
        self.device = QComboBox(); self.device.addItems(["auto", "cpu", "cuda"])
        self.device.setCurrentText(self.cfg.ai.device)
        self.audio_speed = QComboBox(); self.audio_speed.addItems(["0.5x", "0.75x", "1.0x", "1.25x", "1.5x"])
        self.audio_speed.setCurrentText(f"{self.cfg.audio.default_speed}x")
        self.export_folder = QLineEdit(str(self.cfg.resolve("exports")))
        self.logo_path = QLineEdit(self.cfg.export.logo_path)
        self.hospital = QLineEdit(self.cfg.export.hospital_name)
        self.target_url = QLineEdit(self.cfg.browser.target_url)

        self.crash = QCheckBox(); self.crash.setChecked(self.cfg.logging.crash_report)
        self.backup = QCheckBox(); self.backup.setChecked(True)

        c.addLayout(self._row("Theme", self.theme))
        c.addLayout(self._row("Language", self.lang))
        c.addLayout(self._row("Whisper model", self.model))
        c.addLayout(self._row("Device", self.device))
        c.addLayout(self._row("Audio speed", self.audio_speed))
        c.addLayout(self._row("Hospital name", self.hospital))
        c.addLayout(self._row("Target URL", self.target_url))
        c.addLayout(self._row("Crash reports", self.crash))
        c.addLayout(self._row("Backup DB", self.backup))

        fb = QPushButton("Browse..."); fb.clicked.connect(lambda: self._pick_dir(self.export_folder))
        lg = QPushButton("Browse..."); lg.clicked.connect(lambda: self._pick_file(self.logo_path))
        brow = QHBoxLayout()
        brow.addWidget(QLabel("Export folder")); brow.addWidget(self.export_folder); brow.addWidget(fb)
        brow2 = QHBoxLayout()
        brow2.addWidget(QLabel("Logo")); brow2.addWidget(self.logo_path); brow2.addWidget(lg)
        c.addLayout(brow); c.addLayout(brow2)

        root.addWidget(card)

        footer = QHBoxLayout()
        save = QPushButton("Save"); save.setObjectName("primary")
        save.clicked.connect(self._save)
        close = QPushButton("Close"); close.clicked.connect(self.close)
        footer.addSpacerItem(QSpacerItem(0, 0, QSizePolicy.Expanding, QSizePolicy.Minimum))
        footer.addWidget(save); footer.addWidget(close)
        root.addLayout(footer)

    def _pick_dir(self, line: QLineEdit) -> None:
        path = QFileDialog.getExistingDirectory(self, "Export folder")
        if path:
            line.setText(path)

    def _pick_file(self, line: QLineEdit) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Logo", "", "Images (*.png *.svg *.jpg)")
        if path:
            line.setText(path)

    def _save(self) -> None:
        self.cfg.theme = self.theme.currentText()
        self.cfg.language = self.lang.currentText()
        self.cfg.ai.model_size = self.model.currentText()
        self.cfg.ai.device = self.device.currentText()
        self.cfg.audio.default_speed = float(self.audio_speed.currentText().replace("x", ""))
        self.cfg.export.hospital_name = self.hospital.text()
        self.cfg.export.logo_path = self.logo_path.text()
        self.cfg.export.folder = self.export_folder.text()
        self.cfg.browser.target_url = self.target_url.text()
        self.cfg.logging.crash_report = self.crash.isChecked()
        self.cfg.save(CONFIG_PATH)
        QMessageBox.information(self, "Settings", "Saved. Restart for full effect.")
