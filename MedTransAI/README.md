# MedTrans AI Assistant

> Professional, enterprise-grade Windows desktop application that assists authorized
> users with **medical transcription workflows**: AI draft generation, review, and
> export — with optional browser-based submission to the transcription website.

![theme](#) Primary `#2D7FF9` · Accent `#32D583` · Background `#F8FAFC`

---

## Features

| Area | Capability |
|------|------------|
| **Login** | Encrypted credential storage, Remember Me, Save Session, Auto Login, Test Login, Logout |
| **Dashboard** | Today's jobs, completed/remaining, success rate, avg accuracy, avg processing time, storage usage, recent activity, charts, dark mode |
| **Browser Automation** | Playwright (Chromium), persistent authenticated sessions, robust (non-hardcoded) selector detection, retries, timeout recovery |
| **Audio** | MP3/WAV/OGG/WEBM/M4A/AAC, FFmpeg conversion, normalize, noise reduction, trim silence, duration detection |
| **AI Transcription** | Faster-Whisper `large-v3`, FR/EN/SW, GPU + CPU fallback, confidence, punctuation/capitalization, paragraph & medical-abbreviation handling |
| **Review** | Rich editor, search/replace, undo/redo, word/char count, confidence, audio compare, keyboard shortcuts |
| **Export** | Word (.docx), PDF, TXT, JSON, CSV with hospital/project/clip/date/footer/page-numbers/logo |
| **Database** | SQLite — tasks, drafts, export history, statistics, errors, settings |
| **Security** | AES (Fernet) encrypted credentials, never stores plaintext passwords |
| **Resilience** | Multi-threaded workers, cancellation, crash reports, auto-recovery, retry |
| **Packaging** | PyInstaller spec + NSIS installer + desktop shortcut + auto update checker |

---

## Architecture (MVC)

```
main.py → app.py (QApplication bootstrap)
            ├─ controllers/   (AuthController, TaskController)  ← orchestration
            ├─ models/        (Task, Draft, repositories)        ← domain + persistence
            ├─ services/      (auth, audio, ai, browser, export, security, logging, recovery)
            ├─ workers/       (QThread background jobs, cancellable)
            ├─ ui/            (login, main, dashboard, review, settings, theme)
            ├─ database/      (SQLite wrapper)
            └─ config/        (typed AppConfig)
```

Dependency injection is used throughout: services and controllers accept their
dependencies via constructors, making them unit-testable without a GUI.

---

## Requirements

- Python **3.12+**
- Windows **10 / 11**
- FFmpeg on PATH (or `C:/ffmpeg/bin`)
- (Optional) NVIDIA GPU + CUDA for faster transcription

---

## Installation

```bash
pip install -r requirements.txt
playwright install chromium
python main.py
```

For a production build see `installer/build.bat` (PyInstaller + NSIS).

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause audio |
| `Ctrl+S` | Save draft |
| `Ctrl+E` | Export |
| `Ctrl+F` | Search |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |

---

## Project Layout

```
MedTransAI/
├── main.py / app.py
├── config/        typed application configuration
├── database/      SQLite wrapper + connection singleton
├── controllers/   MVC controllers
├── services/      business & infrastructure services
├── models/        domain models + repositories
├── ui/            PySide6 windows + theme
├── workers/       background QThread workers
├── resources/     Qt Designer .ui stubs
├── assets/        icons, logo
├── logs/          rotating logs + crash reports
├── exports/       generated documents
├── recordings/    audio cache
├── temp/          scratch + browser profile
├── docs/          documentation
└── installer/     PyInstaller spec + NSIS script
```

---

## Testing

```bash
pytest -q
```

Unit tests cover config, security (encryption), database repositories and controllers.

---

## License

Proprietary — for authorized users only.
