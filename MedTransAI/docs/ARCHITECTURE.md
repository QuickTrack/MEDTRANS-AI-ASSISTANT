# Architecture Overview

```
                ┌─────────────────────────────────────────────┐
                │                 main.py                      │
                │   MedTransApp (QApplication bootstrap)        │
                └───────────────┬─────────────────────────────┘
                                │
                                ▼
                ┌─────────────────────────────────────────────┐
                │              app.py (window flow)             │
                │  LoginWindow ──logged_in──▶ MainWindow        │
                └───────┬───────────────────┬─────────────────┘
                        │                   │
            ┌───────────▼────┐     ┌─────────▼──────────┐
            │  controllers/  │     │   ui/ (PySide6)     │
            │ Auth/Task      │◀───▶│ login, main, dash,  │
            └───────┬────────┘     │ review, settings    │
                    │              └─────────┬──────────┘
        ┌───────────▼──────────┐             │ signals
        │      services/        │             │
        │ auth audio ai browser │             │
        │ export security log   │             ▼
        │ recovery              │     ┌────────────────────┐
        └───────────┬──────────┘     │   workers/ (QThread)│
                    │                │ transcribe/convert/ │
        ┌───────────▼──────────┐     │ export/browser      │
        │   models/ + database/│     └────────────────────┘
        │ SQLite repositories  │
        └──────────────────────┘

  Config (config/AppConfig) is injected into services & controllers.
  Logging (services/logger) provides rotating logs + crash reports.
```

## Data flow — transcription
1. User loads audio in `ReviewWindow`.
2. `AudioConvertWorker` normalizes via `AudioService` (FFmpeg).
3. `TranscribeWorker` runs `TranscribeService` (Faster-Whisper) → `TranscriptionResult`.
4. Result fills the editor; `DraftRepository` persists it.
5. `ExportWorker` → `ExportService` writes DOCX/PDF/TXT/JSON/CSV.

## Resilience
- Global excepthook → crash report.
- Workers never raise into the GUI; they emit `error`.
- `RecoveryManager` inspects pending tasks/drafts/crash reports on startup.
- Browser ops retry with backoff; transcription supports cooperative cancel.
