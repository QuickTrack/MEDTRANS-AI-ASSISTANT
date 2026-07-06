# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller build specification for MedTrans AI Assistant (Windows)."""

import os
from pathlib import Path

BASE = Path(os.path.dirname(os.path.abspath(__file__))).parent

block_cipher = None

a = Analysis(
    [str(BASE / "main.py")],
    pathex=[str(BASE)],
    binaries=[],
    datas=[
        (str(BASE / "config"), "config"),
        (str(BASE / "resources"), "resources"),
        (str(BASE / "assets"), "assets"),
        (str(BASE / "docs"), "docs"),
    ],
    hiddenimports=[
        "faster_whisper",
        "playwright",
        "ffmpeg",
        "docx",
        "reportlab",
        "cryptography",
        "requests",
        "PySide6.QtCore",
        "PySide6.QtWidgets",
        "PySide6.QtGui",
        "PySide6.QtMultimedia",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="MedTransAI",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(BASE / "assets" / "icon.ico") if (BASE / "assets" / "icon.ico").exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="MedTransAI",
)
