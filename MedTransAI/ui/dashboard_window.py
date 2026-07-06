"""Dashboard window with statistics cards, recent activity and simple charts."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame, QGridLayout,
    QListWidget, QListWidgetItem, QSpacerItem, QSizePolicy, QSizePolicy,
)
from PySide6.QtGui import QPainter, QColor, QPen, QBrush

from config import AppConfig, CONFIG_PATH
from database.connection import get_db
from services.logger import get_logger
from ui import stylesheet

log = get_logger("ui.dashboard")


class _MiniChart(QFrame):
    """Lightweight bar chart drawn with QPainter (no external deps)."""

    def __init__(self, data: list[float], color: str = "#2D7FF9") -> None:
        super().__init__()
        self.data = data
        self.color = QColor(color)
        self.setMinimumHeight(120)

    def paintEvent(self, event) -> None:  # pragma: no cover - GUI
        super().paintEvent(event)
        if not self.data:
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()
        n = len(self.data)
        max_v = max(self.data) or 1
        gap = 6
        bw = (w - gap * (n + 1)) / max(1, n)
        for i, v in enumerate(self.data):
            bh = (v / max_v) * (h - 20)
            x = gap + i * (bw + gap)
            y = h - bh - 10
            painter.setBrush(QBrush(self.color))
            painter.setPen(Qt.NoPen)
            painter.drawRoundedRect(int(x), int(y), int(bw), int(bh), 4, 4)
        painter.end()


class DashboardWindow(QWidget):
    def __init__(self, username: str, cfg: Optional[AppConfig] = None) -> None:
        super().__init__()
        self.username = username
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self.setWindowTitle(f"{self.cfg.name} — Dashboard")
        self.resize(1100, 720)
        self.setStyleSheet(stylesheet(self.cfg.theme))
        self._build_ui()
        self.refresh()

    def _card(self, title: str, value: str, accent: str = "#2D7FF9") -> QFrame:
        card = QFrame()
        card.setObjectName("card")
        layout = QVBoxLayout(card)
        layout.setContentsMargins(16, 14, 16, 14)
        t = QLabel(title)
        t.setStyleSheet("color: #64748B; font-size: 12px;")
        v = QLabel(value)
        v.setObjectName("stat")
        v.setStyleSheet(f"color: {accent};")
        layout.addWidget(t)
        layout.addWidget(v)
        return card

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 24, 24, 24)
        root.setSpacing(18)

        header = QHBoxLayout()
        title = QLabel(f"Welcome, {self.username}")
        title.setObjectName("title")
        header.addWidget(title)
        header.addSpacerItem(QSpacerItem(0, 0, QSizePolicy.Expanding, QSizePolicy.Minimum))
        self.storage_lbl = QLabel("")
        self.storage_lbl.setStyleSheet("color:#64748B;")
        header.addWidget(self.storage_lbl)
        root.addLayout(header)

        self.grid = QGridLayout()
        self.grid.setSpacing(14)
        root.addLayout(self.grid)

        charts_row = QHBoxLayout()
        left = QFrame(); left.setObjectName("card")
        ll = QVBoxLayout(left); self.jobs_chart = _MiniChart([0, 0, 0, 0, 0, 0, 0])
        ll.addWidget(QLabel("Jobs this week")); ll.addWidget(self.jobs_chart)
        right = QFrame(); right.setObjectName("card")
        rl = QVBoxLayout(right); self.acc_chart = _MiniChart([0, 0, 0, 0, 0], "#32D583")
        rl.addWidget(QLabel("Accuracy trend")); rl.addWidget(self.acc_chart)
        charts_row.addWidget(left); charts_row.addWidget(right)
        root.addLayout(charts_row)

        act_card = QFrame(); act_card.setObjectName("card")
        al = QVBoxLayout(act_card)
        al.addWidget(QLabel("Recent activity"))
        self.activity = QListWidget()
        al.addWidget(self.activity)
        root.addWidget(act_card)

    def refresh(self) -> None:
        db = get_db()
        tasks = db.query("SELECT status, COUNT(*) c FROM tasks GROUP BY status")
        by_status = {r["status"]: r["c"] for r in tasks}
        completed = by_status.get("completed", 0)
        total = sum(by_status.values()) or 1
        remaining = by_status.get("pending", 0)
        success = round(100.0 * completed / total, 1)

        stats = db.query("SELECT * FROM statistics ORDER BY date DESC LIMIT 1")
        avg_acc = stats[0]["avg_accuracy"] if stats else 0.0
        avg_time = stats[0]["avg_processing_seconds"] if stats else 0.0

        usage = self._storage_usage()
        self.storage_lbl.setText(f"Storage: {usage}")

        # clear grid
        for i in reversed(range(self.grid.count())):
            w = self.grid.itemAt(i).widget()
            if w:
                w.setParent(None)
        cards = [
            self._card("Today's jobs", str(total)),
            self._card("Completed", str(completed), "#32D583"),
            self._card("Remaining", str(remaining), "#F59E0B"),
            self._card("Success rate", f"{success}%"),
            self._card("Avg accuracy", f"{avg_acc:.1f}%", "#32D583"),
            self._card("Avg processing", f"{avg_time:.1f}s"),
        ]
        for idx, c in enumerate(cards):
            self.grid.addWidget(c, idx // 3, idx % 3)

        # charts
        week = db.query(
            "SELECT date, jobs_completed FROM statistics ORDER BY date DESC LIMIT 7"
        )
        self.jobs_chart.data = [w["jobs_completed"] for w in reversed(week)] or [0]
        acc = db.query("SELECT avg_accuracy FROM statistics ORDER BY date DESC LIMIT 5")
        self.acc_chart.data = [a["avg_accuracy"] for a in reversed(acc)] or [0]
        self.jobs_chart.update(); self.acc_chart.update()

        # activity
        self.activity.clear()
        rows = db.query("SELECT ts, action, detail FROM activity ORDER BY ts DESC LIMIT 20")
        for r in rows:
            item = QListWidgetItem(f"{r['ts'][:19]}  {r['action']}  {r['detail']}")
            self.activity.addItem(item)

    def _storage_usage(self) -> str:
        try:
            total = sum(f.stat().st_size for f in self.cfg.resolve("exports").rglob("*") if f.is_file())
            mb = total / (1024 * 1024)
            return f"{mb:.1f} MB"
        except Exception:
            return "—"
