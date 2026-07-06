# User Manual — MedTrans AI Assistant

## Login Screen
- **Username / Password** — your authorized credentials.
- **Remember me** — stores credentials encrypted (Fernet/AES) on this machine.
- **Save session** — keeps you logged in across restarts (auto login if enabled).
- **Test login** — offline mode for evaluating the UI without a backend.
- **Auto login** — automatically signs you in using saved session + credentials.

Passwords are never stored in plaintext and never transmitted except to the
configured backend during verification.

## Dashboard
The dashboard shows operational metrics: today's jobs, completed, remaining,
success rate, average transcription accuracy, average processing time, storage
usage and recent activity. Charts visualize weekly jobs and accuracy trend.
Toggle **Dark Mode** from the sidebar.

## Review Workflow
1. Click **Load Audio** and select a clip (MP3/WAV/OGG/WEBM/M4A/AAC).
2. Click **Transcribe (AI)** — audio is normalized then processed by Faster-Whisper.
   Progress is shown; you may **Cancel** at any time.
3. The generated draft appears in the editable editor. Use **Search** for
   find/replace, and the word/char/confidence indicators to gauge quality.
4. Press **Play/Pause** (`Space`) to compare the transcript with the audio.
5. **Save Draft** (`Ctrl+S`) persists the text to the database.
6. **Export** (`Ctrl+E`) generates DOCX/PDF/TXT/JSON/CSV into the exports folder.

## Settings
Configure theme, language (en/fr/sw), Whisper model size, device (auto/cpu/cuda),
default audio speed, hospital name, logo, export folder, target URL, crash
reporting and database backup.

## Submitting to the Website
Use the sidebar "Review → Submit" flow (browser automation) to push the approved
transcript back to the transcription website through the authenticated Chromium
session. Selectors are detected dynamically — no brittle hardcoding.

## Security & Privacy
- Credentials are encrypted with a machine-bound key.
- All inputs are sanitized before storage/queries.
- Crash reports are written to `logs/crash_*.log` for diagnostics only.
