@echo off
REM Build script for MedTrans AI Assistant (Windows)
REM 1. Create venv & install deps
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
playwright install chromium

REM 2. Ensure PyInstaller bundle
pyinstaller installer/medtrans.spec --noconfirm

REM 3. Build NSIS installer (requires makensis on PATH)
makensis installer/medtrans_installer.nsi
echo Build complete: installer/MedTransAI-Setup-1.0.0.exe
