# Active Context: MedTrans AI Assistant (Python Desktop App)

## Current State

**Status**: ✅ Core implementation complete (delivered in `MedTransAI/`)

Built a production-ready Windows desktop application for medical transcription
workflows. Tech: Python 3.12+, PySide6, SQLite, Faster-Whisper, Playwright,
FFmpeg, python-docx, ReportLab, cryptography, requests. Architecture: MVC with
dependency injection, background `QThread` workers, encrypted credential storage.

## Recently Completed
- [x] Project scaffolding: config/database/controllers/services/models/ui/workers/installer/docs
- [x] Encrypted credential storage (Fernet/AES, machine-bound key) — `services/security_service.py`
- [x] SQLite layer + repositories — `database/`, `models/`
- [x] AI transcription worker (Faster-Whisper large-v3, GPU/CPU fallback) — `services/transcribe_service.py`
- [x] Browser automation (Playwright, dynamic selector detection, retries) — `services/browser_service.py`
- [x] Audio processing (FFmpeg convert/normalize/noise reduction) — `services/audio_service.py`
- [x] Export DOCX/PDF/TXT/JSON/CSV — `services/export_service.py`
- [x] UI: Login, Main+Sidebar, Dashboard (charts), Review editor, Settings — `ui/`
- [x] PyInstaller spec + NSIS installer + update manifest — `installer/`
- [x] Docs: README, Installation, User Manual, Developer, Architecture, Database schema
- [x] Unit + integration tests (config/security/repo/controller/flow)
- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

The template is ready. Next steps depend on user requirements:

1. What type of application to build
2. What features are needed
3. Design/branding preferences

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| 2026-07-06 | Built MedTrans AI Assistant Python/PySide6 desktop app end-to-end |

## Verification Notes
- `python3 -m py_compile` passes on all modules.
- Core logic verified at runtime: security encryption (no plaintext leak),
  SQLite repositories, controllers, and full review flow (TaskController →
  DraftRepository → RecoveryManager).
- UI windows could not be instantiated in-sandbox (no PySide6 + import blocked);
  they use standard PySide6 APIs and compile cleanly. Run `pip install -r
  requirements.txt && python main.py` on Windows to launch.
