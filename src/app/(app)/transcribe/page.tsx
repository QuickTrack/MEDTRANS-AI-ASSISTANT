"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, Button, Badge, Toggle } from "@/components/ui";
import {
  IconUpload,
  IconMic,
  IconStop,
  IconPlay,
  IconBolt,
  IconCheck,
  IconClock,
  IconUsers,
} from "@/components/icons";
import { useWhisper } from "@/lib/speech";
import { addJob } from "@/lib/jobs";
import { LANGUAGES } from "@/lib/languages";
import { getSpeakerPref, setSpeakerPref } from "@/lib/prefs";

const LANGS = LANGUAGES;

function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function TranscribePage() {
  const router = useRouter();

  const [lang, setLang] = useState("auto");
  const langLabel = LANGS.find((l) => l.code === lang)?.label ?? lang;

  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileDuration, setFileDuration] = useState("");
  const [fileLang, setFileLang] = useState("auto");

  const [elapsed, setElapsed] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [speakers, setSpeakers] = useState(getSpeakerPref());

  function toggleSpeakers() {
    const next = !speakers;
    setSpeakers(next);
    setSpeakerPref(next);
  }

  const elapsedRef = useRef(0);
  const fileUrlRef = useRef<string | null>(null);
  const fileSizeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function finalize(
    text: string,
    audioUrl: string | null,
    sizeBytes: number,
    durationSec?: number,
    detectedLang?: string
  ) {
    const langCode = detectedLang ?? lang;
    const langName =
      LANGS.find((l) => l.code === langCode)?.label ?? langCode;
    const speakerSet = new Set<string>();
    for (const m of text.matchAll(/^Speaker ([A-Z]|\d+):/gm)) {
      speakerSet.add(m[0]);
    }
    const job = addJob({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now()),
      title: file?.name ?? `Recording ${new Date().toLocaleString()}`,
      transcript: text,
      durationSec: Math.round(durationSec ?? elapsedRef.current),
      language: langCode,
      languageLabel: langName,
      audioUrl: audioUrl ?? fileUrlRef.current,
      sizeBytes: sizeBytes || fileSizeRef.current,
      speakers: speakerSet.size || undefined,
      createdAt: Date.now(),
    });
    setJobId(job.id);
    setDone(true);
  }

  const speech = useWhisper(lang, (text, url, size, _dur, detectedLang) => {
    finalize(text, url, size, undefined, detectedLang);
  });

  useEffect(() => {
    speech.setSpeakers(speakers);
  }, [speakers, speech]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    fileUrlRef.current = fileUrl;
  }, [fileUrl]);

  function onPick(f: File | null) {
    if (!f) return;
    setFile(f);
    setDone(false);
    setJobId(null);
    setFileLang(lang);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    fileSizeRef.current = f.size;
    const a = new Audio();
    a.src = url;
    a.onloadedmetadata = () => setFileDuration(fmt(a.duration));
  }

  function startRec() {
    if (speech.listening || speech.loading) return;
    setDone(false);
    setJobId(null);
    setElapsed(0);
    elapsedRef.current = 0;
    speech.start();
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function stopRec() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    speech.stop();
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const live = speech.listening;
  const transcript = (speech.finalText + " " + speech.interimText).trim();

  return (
    <>
      <Topbar title="Transcribe" />
      <main className="scroll-slim flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <p className="font-semibold">Audio source</p>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
              >
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Real-time transcription via a local Whisper model running
              offline in your browser (microphone). Downloads once, then works
              without any server.
            </p>

            <label className="mt-3 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <IconUsers width={16} height={16} className="text-[#2d7ff9]" />
                Speaker recognition
              </span>
              <Toggle checked={speakers} onChange={toggleSpeakers} />
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Labels each turn as Speaker A / B using an on-device voice
              embedding model (no audio leaves this device).
            </p>

            {speech.speakerLoading && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-[#2d7ff9] transition-all"
                    style={{ width: `${speech.speakerProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Downloading speaker model ({speech.speakerProgress}%) —
                  one-time only
                </p>
              </div>
            )}
            {speech.speakerError && (
              <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
                {speech.speakerError}
              </p>
            )}

            <div className="mt-4 flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 py-8 text-center dark:border-slate-700">
              <div
                className={
                  "flex h-14 w-14 items-center justify-center rounded-2xl " +
                  (live
                    ? "bg-[#32d583]/15 text-[#32d583]"
                    : "bg-[#2d7ff9]/10 text-[#2d7ff9]")
                }
              >
                <IconMic width={26} height={26} />
              </div>

              {live ? (
                <>
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                    <IconClock width={16} height={16} />
                    {fmt(elapsed)}
                  </div>
                  <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-[#32d583] transition-all"
                      style={{ width: `${Math.min(100, speech.level * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Listening… speak clearly into your microphone
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm font-medium">
                  {speech.loading
                    ? "Loading local model…"
                    : "Press record to start a live session"}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                {live ? (
                  <Button variant="danger" onClick={stopRec}>
                    <IconStop width={16} height={16} />
                    Stop
                  </Button>
                ) : (
                  <Button onClick={startRec} disabled={speech.loading}>
                    {speech.loading ? (
                      <>
                        <IconBolt width={16} height={16} />
                        Loading {speech.progress}%
                      </>
                    ) : (
                      <>
                        <IconMic width={16} height={16} />
                        Record
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {speech.loading && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-[#2d7ff9] transition-all"
                    style={{ width: `${speech.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Downloading Whisper model ({speech.progress}%) — one-time only
                </p>
              </div>
            )}
            {speech.error && (
              <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
                {speech.error}
              </p>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Or transcribe an audio file directly
              </p>
              <div
                onClick={() =>
                  (
                    document.getElementById(
                      "file-input"
                    ) as HTMLInputElement | null
                  )?.click()
                }
                className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 py-4 text-center text-xs text-slate-500 hover:border-[#2d7ff9] dark:border-slate-700"
              >
                <IconUpload width={16} height={16} className="mr-2" />
                Click to browse (WAV / MP3)
              </div>
              <input
                id="file-input"
                type="file"
                accept="audio/wav,audio/mpeg,audio/x-wav,.wav,.mp3"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
            </div>

            {file && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2d7ff9] text-white">
                      <IconMic width={18} height={18} />
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {(file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                        {fileDuration || "—"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => fileUrl && new Audio(fileUrl).play()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    aria-label="Play"
                  >
                    <IconPlay width={16} height={16} />
                  </button>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Audio language (used for this file)
                  </label>
                  <select
                    value={fileLang}
                    onChange={(e) => setFileLang(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    {LANGS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="brand"
                    disabled={live || speech.fileTranscribing || speech.loading}
                    onClick={() => file && speech.transcribeFile(file, fileLang)}
                  >
                    <IconBolt width={16} height={16} />
                    {speech.fileTranscribing
                      ? `Transcribing ${speech.fileProgress}%`
                      : "Transcribe file"}
                  </Button>
                </div>
                {speech.fileTranscribing && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-[#2d7ff9] transition-all"
                        style={{ width: `${speech.fileProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <p className="font-semibold">Live transcript</p>
              {(live || speech.fileTranscribing) && (
                <Badge tone="green">
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  {speech.fileTranscribing
                    ? `Transcribing file ${speech.fileProgress}%`
                    : speech.transcribing
                    ? "Transcribing…"
                    : "Recording"}
                </Badge>
              )}
            </div>

            <div className="mt-3 min-h-[180px] rounded-xl bg-slate-50 p-4 text-sm leading-relaxed dark:bg-slate-800/60">
              {transcript ? (
                <>
                  {speech.finalText}
                  {speech.interimText && (
                    <span className="text-slate-400">{speech.interimText}</span>
                  )}
                </>
              ) : speech.detecting ? (
                <p className="text-slate-400">
                  Detecting language… {speech.detectProgress}%
                </p>
              ) : (
                <p className="text-slate-400">
                  {live
                    ? "Waiting for speech…"
                    : speech.fileTranscribing
                    ? "Transcribing uploaded audio…"
                    : "Record with the microphone or upload a WAV/MP3 file to transcribe."}
                </p>
              )}
            </div>

            {done && (
              <div className="mt-4 flex items-center gap-2">
                <Badge tone="green">
                  <IconCheck width={12} height={12} className="mr-1" /> Draft
                  ready
                </Badge>
                <Button
                  variant="accent"
                  onClick={() => router.push(`/review?job=${jobId}`)}
                >
                  Send to review
                </Button>
              </div>
            )}
          </Card>
        </div>

        {done && (
          <Card className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">AI draft</p>
              <Badge tone="blue">Source: {langLabel}</Badge>
            </div>
            <pre className="scroll-slim max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed dark:bg-slate-800/60">
              {speech.finalText || "(no speech detected)"}
            </pre>
            <p className="mt-3 text-xs text-slate-400">
              {fmt(elapsed)} captured ·{" "}
              {speech.finalText.trim()
                ? speech.finalText.trim().split(/\s+/).length
                : 0}{" "}
              words
            </p>
          </Card>
        )}
      </main>
    </>
  );
}
