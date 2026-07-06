# Developer Documentation — MedTrans AI Assistant

## Layering (MVC + services)
- **Models** (`models/`): dataclasses `Task`, `Draft`, `ExportRecord` plus
  `*Repository` classes that persist via `database.connection.get_db()`.
- **Views** (`ui/`): PySide6 widgets. No business logic — they emit signals and
  call controllers/workers.
- **Controllers** (`controllers/`): thin orchestrators injected with services.
- **Services** (`services/`): stateless-ish helpers (audio, ai, browser, export,
  security, logging, recovery). Each accepts an optional `AppConfig`.
- **Workers** (`workers/`): `QThread` subclasses for background, cancellable work.
- **Config** (`config/`): single typed `AppConfig` dataclass, JSON-backed.

## Dependency Injection
```python
cfg = AppConfig.load(CONFIG_PATH)
sec = SecurityService(cfg)
auth = AuthController(AuthService(sec), cfg)
```
No global singletons are required by services; only `get_db()` is a lazy singleton.

## Concurrency Model
Long operations (transcription, FFmpeg, export, browser) run in `Worker`
(QThread). The UI thread only updates progress bars and receives results via
signals. Cancellation is cooperative via `worker.cancel()`.

## Error Handling
- `services/logger.py` installs a global `sys.excepthook` that logs and writes a
  crash report. Workers catch exceptions and emit `error` instead of crashing.
- Retry logic lives in `BrowserService._retry` and transcribe/audio wrappers.

## Adding a New Export Format
1. Add a `to_<fmt>(task, draft, dst)` method to `ExportService`.
2. Append `fmt` to `AppConfig.export.formats`.
3. `export_all` will pick it up automatically.

## Database Migrations
Schema is declarative in `database/__init__.py` (`SCHEMA_STATEMENTS`). Add new
`CREATE TABLE IF NOT EXISTS` statements; they run idempotently on startup.

## Testing
- `tests/test_core.py` — config, security round-trip, repositories, controllers.
- GUI tests use `pytest-qt` (requires a display / offscreen platform).

## Build & Release
See `README.md` and `installer/build.bat`. Version is defined in `config/__init__.py`
(`APP_VERSION`) and consumed by the auto-update checker.
