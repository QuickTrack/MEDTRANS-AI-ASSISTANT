"""Review workflow window: rich-text editor, audio compare, AI draft review and export."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from PySide6.QtCore import Qt, QUrl
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTextEdit, QPushButton,
    QFrame, QLineEdit, QComboBox, QProgressBar, QFileDialog, QMessageBox,
    QDialog, QSizePolicy, QSpacerItem,
)
from PySide6.QtMultimedia import QMediaPlayer, QAudioOutput

from config import AppConfig, CONFIG_PATH
from database.connection import get_db
from models import Task, Draft, TaskRepository, DraftRepository
from services.logger import get_logger
from workers.transcribe_worker import TranscribeWorker
from workers.audio_convert_worker import AudioConvertWorker
from workers.export_worker import ExportWorker
from ui import stylesheet

log = get_logger("ui.review")


class _SearchDialog(QDialog):
    def __init__(self, parent: "ReviewWindow") -> None:
        super().__init__(parent)
        self.parent = parent
        self.setWindowTitle("Find / Replace")
        self.resize(360, 140)
        layout = QVBoxLayout(self)
        self.find = QLineEdit(); self.find.setPlaceholderText("Find")
        self.replace = QLineEdit(); self.replace.setPlaceholderText("Replace")
        row = QHBoxLayout()
        self.b_find = QPushButton("Find"); self.b_next = QPushButton("Next")
        self.b_replace = QPushButton("Replace"); self.b_all = QPushButton("Replace All")
        self.b_find.clicked.connect(self._find)
        self.b_next.clicked.connect(self._next)
        self.b_replace.clicked.connect(self._replace)
        self.b_all.clicked.connect(self._replace_all)
        row.addWidget(self.b_find); row.addWidget(self.b_next)
        row.addWidget(self.b_replace); row.addWidget(self.b_all)
        layout.addWidget(self.find); layout.addWidget(self.replace); layout.addLayout(row)
        self._pos = 0

    def _find(self) -> None:
        self._pos = self.parent.editor.toPlainText().lower().find(self.find.text().lower())
        self._next()

    def _next(self) -> None:
        text = self.parent.editor.toPlainText()
        idx = text.lower().find(self.find.text().lower(), self._pos + 1)
        if idx >= 0:
            self._pos = idx
            cursor = self.parent.editor.textCursor()
            cursor.setPosition(idx)
            cursor.setPosition(idx + len(self.find.text()), cursor.MoveMode.KeepAnchor)
            self.parent.editor.setTextCursor(cursor)

    def _replace(self) -> None:
        self.parent.editor.insertPlainText(self.replace.text())

    def _replace_all(self) -> None:
        text = self.parent.editor.toPlainText()
        new = text.replace(self.find.text(), self.replace.text())
        self.parent.editor.setPlainText(new)


class ReviewWindow(QWidget):
    def __init__(self, username: str, cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.username = username
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self.current_task: Optional[Task] = None
        self.current_draft: Optional[Draft] = None
        self.worker: Optional[TranscribeWorker] = None
        self.audio_player = QMediaPlayer()
        self.audio_output = QAudioOutput()
        self.audio_player.setAudioOutput(self.audio_output)
        self._build_ui()
        self._install_shortcuts()

    def _build_ui(self) -> None:
        self.setWindowTitle(f"{self.cfg.name} — Review")
        self.resize(1200, 800)
        self.setStyleSheet(stylesheet(self.cfg.theme))
        root = QVBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(12)

        toolbar = QHBoxLayout()
        self.load_audio_btn = QPushButton("Load Audio")
        self.load_audio_btn.clicked.connect(self._load_audio)
        self.transcribe_btn = QPushButton("Transcribe (AI)")
        self.transcribe_btn.setObjectName("primary")
        self.transcribe_btn.clicked.connect(self._start_transcribe)
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self._cancel)
        self.play_btn = QPushButton("Play/Pause")
        self.play_btn.clicked.connect(self._toggle_play)
        self.save_btn = QPushButton("Save Draft")
        self.save_btn.setObjectName("accent")
        self.save_btn.clicked.connect(self._save_draft)
        self.export_btn = QPushButton("Export")
        self.export_btn.clicked.connect(self._export)
        self.search_btn = QPushButton("Search")
        self.search_btn.clicked.connect(self._open_search)

        for b in (self.load_audio_btn, self.transcribe_btn, self.cancel_btn,
                  self.play_btn, self.save_btn, self.export_btn, self.search_btn):
            toolbar.addWidget(b)
        toolbar.addSpacerItem(QSpacerItem(0, 0, QSizePolicy.Expanding, QSizePolicy.Minimum))
        self.status_lbl = QLabel("Ready")
        toolbar.addWidget(self.status_lbl)
        root.addLayout(toolbar)

        self.progress = QProgressBar(); self.progress.setValue(0)
        root.addWidget(self.progress)

        body = QHBoxLayout()
        editor_card = QFrame(); editor_card.setObjectName("card")
        el = QVBoxLayout(editor_card)
        el.addWidget(QLabel("Transcript (editable)"))
        self.editor = QTextEdit(); self.editor.setObjectName("editor")
        self.editor.textChanged.connect(self._update_counts)
        el.addWidget(self.editor)

        meta = QHBoxLayout()
        self.conf_lbl = QLabel("Confidence: —")
        self.word_lbl = QLabel("Words: 0")
        self.char_lbl = QLabel("Chars: 0")
        meta.addWidget(self.conf_lbl); meta.addWidget(self.word_lbl); meta.addWidget(self.char_lbl)
        el.addLayout(meta)

        side = QFrame(); side.setObjectName("card")
        sl = QVBoxLayout(side)
        sl.addWidget(QLabel("Task info"))
        self.task_info = QTextEdit(); self.task_info.setReadOnly(True)
        sl.addWidget(self.task_info)
        sl.addWidget(QLabel("Audio source"))
        self.audio_path_lbl = QLabel("No audio loaded")
        sl.addWidget(self.audio_path_lbl)
        self.speed = QComboBox()
        self.speed.addItems(["0.5x", "0.75x", "1.0x", "1.25x", "1.5x"])
        self.speed.setCurrentText("1.0x")
        sl.addWidget(QLabel("Playback speed"))
        sl.addWidget(self.speed)
        sl.addSpacerItem(QSpacerItem(0, 0, QSizePolicy.Minimum, QSizePolicy.Expanding))

        body.addWidget(editor_card, 3)
        body.addWidget(side, 1)
        root.addLayout(body)

    def _install_shortcuts(self) -> None:
        from PySide6.QtGui import QShortcut, QKeySequence

        QShortcut(QKeySequence("Ctrl+S"), self).activated.connect(self._save_draft)
        QShortcut(QKeySequence("Ctrl+E"), self).activated.connect(self._export)
        QShortcut(QKeySequence("Ctrl+F"), self).activated.connect(self._open_search)
        QShortcut(QKeySequence("Ctrl+Z"), self).activated.connect(self.editor.undo)
        QShortcut(QKeySequence("Ctrl+Shift+Z"), self).activated.connect(self.editor.redo)
        QShortcut(QKeySequence("Space"), self).activated.connect(self._toggle_play)

    def _load_audio(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Select audio",
            str(self.cfg.resolve("recordings")),
            "Audio (*.mp3 *.wav *.ogg *.webm *.m4a *.aac)",
        )
        if path:
            self.audio_path_lbl.setText(path)
            self.audio_player.setSource(QUrl.fromLocalFile(path))
            self.status_lbl.setText("Audio loaded")

    def _start_transcribe(self) -> None:
        path = self.audio_path_lbl.text()
        if not path or not os.path.exists(path):
            QMessageBox.warning(self, "Transcribe", "Load an audio file first.")
            return
        dst = self.cfg.resolve("temp") / (Path(path).stem + "_norm.wav")
        self.progress.setValue(5)
        self.status_lbl.setText("Preparing audio...")
        conv = AudioConvertWorker(path, str(dst), self.cfg)
        conv.finished.connect(lambda p: self._run_transcribe(p))
        conv.error.connect(lambda e: self._on_error(e))
        conv.start()
        self._conv_worker = conv

    def _run_transcribe(self, wav_path: str) -> None:
        self.status_lbl.setText("Transcribing...")
        self.worker = TranscribeWorker(wav_path, self.cfg)
        self.worker.progress.connect(lambda v: self.progress.setValue(int(v * 90) + 5))
        self.worker.finished.connect(self._on_transcribed)
        self.worker.error.connect(self._on_error)
        self.worker.start()

    def _on_transcribed(self, result) -> None:
        self.editor.setPlainText(result.text)
        self.conf_lbl.setText(f"Confidence: {result.avg_confidence:.1%}")
        self.progress.setValue(100)
        self.status_lbl.setText("Transcription complete")
        get_db().log_activity("transcribe", f"confidence={result.avg_confidence:.2f}")
        if self.current_task is None:
            self.current_task = TaskRepository.save(Task(project_name="Imported", status="draft"))
        self.current_draft = Draft(
            task_id=self.current_task.id, content=result.text,
            confidence=result.avg_confidence,
        )
        DraftRepository.save(self.current_draft)

    def _cancel(self) -> None:
        if self.worker and self.worker.isRunning():
            self.worker.cancel()
            self.status_lbl.setText("Cancelling...")
        if getattr(self, "_conv_worker", None) and self._conv_worker.isRunning():
            self._conv_worker.cancel()

    def _toggle_play(self) -> None:
        if self.audio_player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.audio_player.pause()
        else:
            self.audio_player.play()

    def _save_draft(self) -> None:
        if self.current_task is None:
            self.current_task = TaskRepository.save(Task(project_name="Imported", status="draft"))
        self.current_draft = Draft(
            task_id=self.current_task.id, content=self.editor.toPlainText(),
        )
        DraftRepository.save(self.current_draft)
        get_db().log_activity("save_draft", f"task_id={self.current_task.id}")
        self.status_lbl.setText("Draft saved")

    def _export(self) -> None:
        if not self.editor.toPlainText().strip():
            QMessageBox.warning(self, "Export", "Nothing to export.")
            return
        self._save_draft()
        base = f"transcript_{self.current_task.id if self.current_task else 'draft'}"
        self.status_lbl.setText("Exporting...")
        w = ExportWorker(self.current_task, self.current_draft, base, self.cfg)
        w.finished.connect(lambda paths: self._on_exported(paths))
        w.error.connect(self._on_error)
        w.start()

    def _on_exported(self, paths) -> None:
        self.status_lbl.setText("Exported: " + ", ".join(Path(p).suffix for p in paths))
        get_db().log_activity("export", f"{len(paths)} files")

    def _open_search(self) -> None:
        _SearchDialog(self).exec()

    def _update_counts(self) -> None:
        text = self.editor.toPlainText()
        self.word_lbl.setText(f"Words: {len(text.split())}")
        self.char_lbl.setText(f"Chars: {len(text)}")

    def _on_error(self, msg: str) -> None:
        self.progress.setValue(0)
        self.status_lbl.setText("Error")
        get_db().log_error("ERROR", msg)
        QMessageBox.critical(self, "Error", msg)

    def set_task(self, task: Task, info_text: str) -> None:
        self.current_task = task
        self.task_info.setPlainText(info_text)
