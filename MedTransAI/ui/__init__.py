"""
Central UI theme and stylesheet for the MedTrans AI Assistant.

Medical theme:
  Primary  : #2D7FF9
  Accent   : #32D583
  Background: #F8FAFC
Dark mode variant included.
"""

from __future__ import annotations

PRIMARY = "#2D7FF9"
ACCENT = "#32D583"
BG = "#F8FAFC"
BG_DARK = "#0F172A"
SURFACE = "#FFFFFF"
SURFACE_DARK = "#1E293B"
TEXT = "#0F172A"
TEXT_DARK = "#E2E8F0"
MUTED = "#64748B"
DANGER = "#EF4444"

LIGHT_STYLESHEET = f"""
QWidget {{
    background-color: {BG};
    color: {TEXT};
    font-family: 'Segoe UI', 'Inter', sans-serif;
    font-size: 13px;
}}
QFrame#card {{
    background-color: {SURFACE};
    border-radius: 12px;
    border: 1px solid #E2E8F0;
}}
QPushButton#primary {{
    background-color: {PRIMARY};
    color: white;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 600;
}}
QPushButton#primary:hover {{ background-color: #1E6FE0; }}
QPushButton#accent {{
    background-color: {ACCENT};
    color: white;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 600;
}}
QPushButton {{
    background-color: {SURFACE};
    border: 1px solid #CBD5E1;
    border-radius: 8px;
    padding: 6px 12px;
}}
QPushButton:hover {{ border-color: {PRIMARY}; }}
QLineEdit, QTextEdit, QPlainTextEdit, QComboBox {{
    background-color: {SURFACE};
    border: 1px solid #CBD5E1;
    border-radius: 8px;
    padding: 6px;
}}
QTextEdit#editor {{ border-radius: 10px; }}
QListWidget, QTableWidget {{
    background-color: {SURFACE};
    border-radius: 8px;
    gridline-color: #E2E8F0;
}}
QProgressBar {{
    border-radius: 6px;
    text-align: center;
    background: #E2E8F0;
}}
QProgressBar::chunk {{ background-color: {PRIMARY}; border-radius: 6px; }}
QLabel#title {{ font-size: 20px; font-weight: 700; }}
QLabel#stat {{ font-size: 26px; font-weight: 700; color: {PRIMARY}; }}
"""

DARK_STYLESHEET = f"""
QWidget {{
    background-color: {BG_DARK};
    color: {TEXT_DARK};
    font-family: 'Segoe UI', 'Inter', sans-serif;
    font-size: 13px;
}}
QFrame#card {{
    background-color: {SURFACE_DARK};
    border-radius: 12px;
    border: 1px solid #334155;
}}
QPushButton#primary {{ background-color: {PRIMARY}; color: white; border-radius: 8px; padding: 8px 16px; font-weight: 600; }}
QPushButton#primary:hover {{ background-color: #1E6FE0; }}
QPushButton#accent {{ background-color: {ACCENT}; color: white; border-radius: 8px; padding: 8px 16px; font-weight: 600; }}
QPushButton {{ background-color: {SURFACE_DARK}; border: 1px solid #334155; border-radius: 8px; padding: 6px 12px; color: {TEXT_DARK}; }}
QPushButton:hover {{ border-color: {PRIMARY}; }}
QLineEdit, QTextEdit, QPlainTextEdit, QComboBox {{
    background-color: #0F172A; border: 1px solid #334155; border-radius: 8px; padding: 6px; color: {TEXT_DARK};
}}
QTextEdit#editor {{ border-radius: 10px; }}
QListWidget, QTableWidget {{ background-color: {SURFACE_DARK}; border-radius: 8px; gridline-color: #334155; color: {TEXT_DARK}; }}
QProgressBar {{ border-radius: 6px; text-align: center; background: #334155; }}
QProgressBar::chunk {{ background-color: {PRIMARY}; border-radius: 6px; }}
QLabel#title {{ font-size: 20px; font-weight: 700; }}
QLabel#stat {{ font-size: 26px; font-weight: 700; color: {PRIMARY}; }}
"""


def stylesheet(theme: str = "light") -> str:
    return DARK_STYLESHEET if theme == "dark" else LIGHT_STYLESHEET
