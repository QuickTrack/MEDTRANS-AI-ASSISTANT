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
- [x] Built real MedTrans Next.js UI: login (auth gate), app shell (sidebar+topbar), Dashboard, Transcribe (audio upload + simulated Whisper pipeline), Review editor, Export, Settings (dark mode + persistence)
- [x] Hardened `electron/main.js`: single-instance lock (no more EADDRINUSE from repeated launches), free-port detection, bundled Node fallback, graceful error page
- [x] Replaced all hardcoded dummy data with REAL functionality: live microphone transcription via the browser Web Speech API (`src/lib/speech.ts`), live level meter + MediaRecorder capture (`src/lib/audio.ts`), and a localStorage-backed jobs store (`src/lib/jobs.ts`) that feeds real stats to Dashboard / Review / Export.
- [x] Transcribe page now records in real time (live interim+final transcript, timer, mic meter) and persists the session as a job.
- [x] Review page loads the real transcript for `?job=<id>`; Export builds the real document (txt/docx/pdf/json/csv) from it; Dashboard computes jobs-today / completed / throughput / language mix / storage from the store.
- [x] Replaced the browser Web Speech API (Google cloud — failed with "network" error) with fully OFFLINE local Whisper via `@huggingface/transformers` (`src/lib/speech.ts` → `useWhisper`). Captures mic (AnalyserNode meter + MediaRecorder), transcribes in chunks every 3s during recording, final pass on stop; downloads model once, no Google dependency.
- [x] Added **offline in-browser speaker recognition (diarization)**: `src/lib/diarize.worker.ts` loads `Xenova/wav2vec2-base-superb-sv` (feature-extraction, L2-normalized mean-pooled 256-d embeddings, q8→fp32 fallback); `src/lib/speaker.ts` `SpeakerRecognizer` runs it in a Web Worker, chunks audio into 3s windows, and does online cosine-similarity clustering (threshold 0.7, max 6 speakers) into "Speaker A/B/C…" labels; `useWhisper` attaches each transcription unit's speaker to `Segment.speaker` and renders the transcript **inline labeled** ("Speaker A: …"). `format.ts` `Segment` gained `speaker?`; `src/lib/prefs.ts` persists the toggle; Transcribe + Settings pages expose the toggle with model-download progress; Review shows a speaker count; Job gained `speakers?`. lint/typecheck/build pass.
- [x] Added **multi-file batch transcription queue** on `transcribe/page.tsx`: file input accepts `multiple`; queued items (with per-item language select, status badge, remove) are transcribed sequentially via `await speech.transcribeFile(...)`, each producing its own job. Added queue controls (Transcribe queue (N) / Stop / Clear), per-file progress, a "Batch complete" summary with links to Dashboard/Review, and a `currentFileRef` so `finalize` uses the active item's metadata. Rewrote the page's file section into the queue UI. lint/typecheck/build pass.

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/layout.tsx` | Root layout + providers (theme/auth) | ✅ Ready |
| `src/app/login/page.tsx` | Login (auth gate) | ✅ Ready |
| `src/app/(app)/layout.tsx` | Authed shell (sidebar + gate) | ✅ Ready |
| `src/app/(app)/dashboard/page.tsx` | Dashboard (stats/charts) | ✅ Ready |
| `src/app/(app)/transcribe/page.tsx` | Live mic recording + real-time Web Speech transcription | ✅ Ready |
| `src/app/(app)/review/page.tsx` | Review editor (loads real job transcript) | ✅ Ready |
| `src/app/(app)/export/page.tsx` | Export (builds real doc from transcript) | ✅ Ready |
| `src/app/(app)/settings/page.tsx` | Settings (theme/langs/security) | ✅ Ready |
| `src/components/` | ui primitives, Sidebar, Topbar, icons | ✅ Ready |
| `src/lib/` | auth + theme providers, `jobs.ts` (store), `speech.ts` (`useWhisper` local Whisper), `audio.ts` (unused mic helper) | ✅ Ready |
| `electron/main.js` | Hardened Electron main | ✅ Ready |
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
| 2026-07-06 | Added Electron desktop packaging for the Next.js app (portable `.exe`) |
| 2026-07-07 | Fixed "Cannot find module 'next'" at runtime: `build-exe.mjs` now bundles Node (`vendor/node`→`resources/node`) and places the standalone server at `resources/server` (with its `node_modules`); `dist` now uses `build:exe`. Original electron-builder artifact was a stale build missing `.next/standalone/node_modules`. |
| 2026-07-07 | Replaced placeholder "Next.js Template" UI with a real MedTrans AI Assistant Next.js app (login-gated shell + Dashboard/Transcribe/Review/Export/Settings) and hardened `electron/main.js` (single-instance lock, free-port detection, graceful errors). Rebuilt `release/win-portable/MedTrans AI Assistant.exe`. |
| 2026-07-07 | Removed all hardcoded dummy data: added `src/lib/jobs.ts` (localStorage jobs store), `src/lib/speech.ts` (Web Speech API real-time STT), `src/lib/audio.ts` (mic level meter + MediaRecorder), and rewired Transcribe/Review/Export/Dashboard to use real audio + real computed data. `bun lint`, `bun typecheck`, and `next build` all pass. |
| 2026-07-07 | Fixed "Speech error: network" (Web Speech API = Google cloud). Switched to OFFLINE local Whisper via `@huggingface/transformers` (`useWhisper` in `src/lib/speech.ts`): mic capture + meter + chunked live transcription + final pass on stop. Rebuilt `release/win-portable`. lint/typecheck/build pass. |
| 2026-07-07 | Fixed "Model not ready" after Whisper download: `pipeline()` session init failed because onnxruntime-web needed SharedArrayBuffer (cross-origin isolation) which the Next standalone server doesn't send. Fix: `env.backends.onnx.wasm.numThreads = 1` (uses asyncify WASM, no SAB) + dtype fallback q8→fp32 + surface the real load error. WASM is bundled by Next into `static/media` (no CDN). Rebuilt. |
| 2026-07-07 | Fixed `ERROR_CODE:1 weight_merged_0_scale ... DequantizeLinear`: the `q8` weights of `Xenova/whisper-base` are missing the decoder-embedding NBits scale in transformers.js v4 (session creation fails lazily on first inference, so the q8→fp32 fallback never engaged). Fix: use `dtype:"fp32"` only (standard weights, no NBits bug) + surface transcription errors in `transcribe()`. Rebuilt. |
| 2026-07-07 | Fixed lag + inaccurate capture: moved Whisper inference into a Web Worker (`src/lib/whisper.worker.ts`) so the main thread is not blocked (which was starving the ScriptProcessor microphone capture and dropping samples). Transcribe incrementally in ~6s windows with 1.5s overlap (not re-transcribing the whole buffer every 3s), and use linear-resampling to 16k. UI badge shows "Transcribing…" while a window is in flight. Rebuilt. |
| 2026-07-07 | Added direct file transcription (WAV/MP3) alongside live mic. `useWhisper.transcribeFile(file)` decodes audio via `AudioContext.decodeAudioData`, mixes to mono, splits into 30s windows, feeds the same worker (linear-resampled to 16k), streams results into the live transcript, and finalizes a job with the file's URL/size/duration. No mic needed. `transcribeFile`/`fileTranscribing`/`fileProgress` exposed. Rebuilt. |
| 2026-07-07 | Multilingual transcription + offline translation: added `src/lib/languages.ts` (14 languages: whisper token + NLLB FLORES-200 code), wired `useWhisper` to `whisperLang()`. Transcribe language selector uses full list (incl. French/Spanish/German/Arabic). Added offline translation via NLLB-200 (`src/lib/translate.worker.ts` + `useTranslate`), surfaced as a Translate panel on Review (target dropdown, progress, result, replace/copy) and shown on Export. Job gained `translation`/`translationLang`. lint/typecheck/build pass. |
| 2026-07-07 | Language auto-detection: transformers.js v4.2.0 silently defaults Whisper to English when no language is given (no native detection). Added a dedicated detection pass in `whisper.worker.ts` using `Xenova/w2v-bert-2.0-lang-id` (`audio-classification`), returned as a FLORES-200 code, mapped to our language via `languageFromFlores()` in `languages.ts`. `useWhisper` runs detection on first window (live) / first 30s (file) when language is "auto", feeds the detected Whisper token into transcription, exposes `detecting`/`detectProgress`, and passes the detected language code to `onComplete` so the job stores the real source language. Falls back to English on detection error. lint/typecheck/build pass. |
| 2026-07-07 | Hardened language detection after reports of French audio detected as English. In `languages.ts` replaced FLORES-only mapping with an expanded alias map (FLORES + ISO-639-1/3/2) and added `pickLanguage(labels)` that chooses the first supported language from the classifier's top-k. In `whisper.worker.ts` the detect pass now peak-normalizes audio, requests top_k=5, posts `labels`, and the classifier loader falls back q8→fp32 if the quantized weights fail to load. In `speech.ts` live detection now waits for actual speech (RMS gate) before running, using `pickLanguage`. Addresses silent-first-window and model-load-failure cases that previously defaulted to English. lint/typecheck/build pass. |
| 2026-07-08 | Fixed NLLB translation session-creation failure (`ERROR_CODE:1 weight_merged_0_scale ... DequantizeLinear`). The bundled `onnxruntime-web@1.26.0-dev` fails in `TransposeDQWeightsForMatMulNBits` on the dynamically-fused q8 weights of `Xenova/nllb-200-distilled-600M`. Fix: pass `session_options: { graphOptimizationLevel: "basic" }` to `pipeline()` in `src/lib/translate.worker.ts` (skips the broken layout optimizer; MatMulNBits still runs). lint/typecheck pass. |
| 2026-07-08 | New features: (1) Manual audio-language selection after uploading a file — added `fileLang` state + language `<select>` in the uploaded-file card on `transcribe/page.tsx`; `useWhisper.transcribeFile(file, langOverride)` now threads the override through `speech.ts` (`detectLang(override)` + auto-detect gate). (2) Fixed Translate button overflowing off-screen on `review/page.tsx` — the two language selects keep `flex-1 min-w-0` in one row and the Translate button moved to its own full-width row (`w-full`). lint/typecheck pass. |
| 2026-07-08 | Added offline in-browser speaker recognition: `src/lib/diarize.worker.ts` (Xenova/wav2vec2-base-superb-sv embeddings) + `src/lib/speaker.ts` (online clustering) + `useWhisper` integration for inline "Speaker A/B" labels, toggle on Transcribe/Settings, speaker count on Review. lint/typecheck/build pass. |

## Electron Desktop Packaging (2026-07-06)

Wrapped the Next.js 16 app into a Windows desktop `.exe` using **Electron 43**
(no Rust/Tauri needed; Node already present). Approach: Next.js `output:
"standalone"` builds a self-contained server; Electron spawns it via `node`
and loads `http://localhost:3000` in a `BrowserWindow`.

Key files:
- `next.config.ts` → `output: "standalone"`
- `electron/main.js` → CommonJS Electron main (spawns Next standalone server,
  waits for port, opens window). Uses `require("electron")`.
- `scripts/build-exe.mjs` → assembles portable build: copies `electron-dist`
  runtime, our `electron/` + `package.json` into `resources/app`; copies the
  Next.js `.next/standalone` (+ static/public) into `resources/server`; copies
  the bundled Node runtime `vendor/node` → `resources/node`; renames
  `electron.exe` → `MedTrans AI Assistant.exe`. `electron/main.js` resolves the
  server from `resources/server` and uses `resources/node/node.exe` first.
- `electron-dist/` → extracted official electron 43 win32-x64 runtime
  (gitignored; generated by build). `default_app.asar` removed.
- `vendor/node/` → bundled Node.js runtime used by the packaged app (so no
  system Node is required).
- `package.json` → `"main": "electron/main.js"`, `build:` electron-builder
  config (`dist:electron`), `build:exe` script, and `dist` → `build:exe`.

Commands:
- `bun run build:exe` (or `bun run dist`) → produces working portable `.exe`
  at `release/win-portable/MedTrans AI Assistant.exe`.
- `bun run dist:electron` → electron-builder portable (needs a code-signing
  cert; run with `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip signing).

Notes / gotchas:
- electron-builder fails in THIS sandbox (Defender locks `app.asar`/`default_app.asar`
  during asar packing). `build:exe` (manual assembly, no asar) avoids it.
- Electron 43 does NOT auto-load `resources/app` in a headless sandbox; the
  window also can't render headless. Verified server boots (TCP :3000 OK) and
  packaging structure is correct. Run the `.exe` on a real Windows PC to see
  the window.
- `electron/main.js` MUST be CommonJS (no TS syntax) since it's loaded by
  electron's runtime as plain JS.
- `.gitignore` ignores `/electron-dist/` and `/release/`.


## Verification Notes
- `python3 -m py_compile` passes on all modules.
- Core logic verified at runtime: security encryption (no plaintext leak),
  SQLite repositories, controllers, and full review flow (TaskController →
  DraftRepository → RecoveryManager).
- UI windows could not be instantiated in-sandbox (no PySide6 + import blocked);
  they use standard PySide6 APIs and compile cleanly. Run `pip install -r
  requirements.txt && python main.py` on Windows to launch.

| 2026-07-07 | Implemented native Whisper language detection in `whisper.worker.ts` to replace the unreliable separate `w2v-bert-2.0-lang-id` classifier for multilingual models. transformers.js v4.2.0 (latest stable) does not have native Whisper detection (PR #1541 still open). Workaround: added `WhisperLangLogitsProcessor` (extends `LogitsProcessor`) that suppresses all non-language-token logits. `detectNativeLanguage()` runs a 1-token generation with `model.generate()` using only `<|startoftranscript|>` as decoder input, restricted to the model's `lang_to_id` vocabulary, then decodes the predicted token back to a 2-letter language code. Detection handler in the worker now prefers native Whisper inference and falls back to the existing classifier only on error. `speech.ts` unchanged. lint/typecheck pass. |

| 2026-07-07 | Implemented native Whisper language detection in `whisper.worker.ts` to replace the unreliable separate `w2v-bert-2.0-lang-id` classifier for multilingual models. transformers.js v4.2.0 (latest stable) does not have native Whisper detection (PR #1541 still open). Workaround: added `WhisperLangLogitsProcessor` (extends `LogitsProcessor`) that suppresses all non-language-token logits. `detectNativeLanguage()` runs a 1-token generation with `model.generate()` using only `<|startoftranscript|>` as decoder input, restricted to the model's `lang_to_id` vocabulary, then decodes the predicted token back to a 2-letter language code. Detection handler in the worker now prefers native Whisper inference and falls back to the existing classifier only on error. `speech.ts` unchanged. lint/typecheck pass. |
