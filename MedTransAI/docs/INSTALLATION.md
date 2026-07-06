# Installation Guide — MedTrans AI Assistant

## 1. Prerequisites
- Windows 10 or 11 (64-bit)
- Python 3.12+ (add to PATH during install)
- FFmpeg: download from https://ffmpeg.org and place `ffmpeg.exe`/`ffprobe.exe`
  on PATH or in `C:/ffmpeg/bin`
- (Recommended) NVIDIA GPU with CUDA 12.x for GPU transcription

## 2. Install dependencies
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

## 3. Run from source
```bash
python main.py
```

## 4. Production install (executable)
```bash
pyinstaller installer/medtrans.spec --noconfirm
makensis installer/medtrans_installer.nsi
```
The installer creates a desktop shortcut and Start Menu entry.

## 5. First launch
1. Enter your username/password.
2. Enable **Remember me** to store encrypted credentials, or **Save session**
   for auto-login next time.
3. Use **Test login** for offline evaluation.
4. Configure the transcription website URL, model size and device in **Settings**.

## 6. Troubleshooting
- Transcription slow → set Device = `cuda` in Settings (requires GPU).
- Browser not detected → run `playwright install chromium`.
- Crash on start → check `logs/crash_*.log` and submit to support.
