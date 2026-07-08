"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, Button, Badge, Toggle } from "@/components/ui";
import {
  IconUpload,
  IconMic,
  IconStop,
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

type QueueStatus = "queued" | "processing" | "done" | "error";
type QueueItem = {
  id: string;
  file: File;
  lang: string;
  status: QueueStatus;
};

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}

function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const STATUS_TONE: Record<QueueStatus, "slate" | "blue" | "green" | "rose"> = {
  queued: "slate",
  processing: "blue",
  done: "green",
  error: "rose",
};
const STATUS_LABEL: Record<QueueStatus, string> = {
  queued: "Queued",
  processing: "Transcribing",
  done: "Done",
  error: "Error",
};

export default function TranscribePage() {
  const router = useRouter();

  const [lang, setLang] = useState("auto");
  const langLabel = LANGS.find((l) => l.code === lang)?.label ?? lang;

  const [elapsed, setElapsed] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [speakers, setSpeakers] = useState(getSpeakerPref());

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueActive, setQueueActive] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [queueFinished, setQueueFinished] = useState(0);

  function toggleSpeakers() {
    const next = !speakers;
    setSpeakers(next);
    setSpeakerPref(next);
  }

  const elapsedRef = useRef(0);
  const fileUrlRef = useRef<string | null>(null);
  const fileSizeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentFileRef = useRef<{
    name: string;
    url: string;
    size: number;
  } | null>(null);
  const cancelQueueRef = useRef(false);

  function finalize(
    text: string,
    audioUrl: string | null,
    sizeBytes: number,
    durationSec?: number,
    detectedLang?: string
  ) {
    const cf = currentFileRef.current;
    const title = cf?.name ?? `Recording ${new Date().toLocaleString()}`;
    const aUrl = audioUrl ?? cf?.url ?? null;
    const size = sizeBytes || cf?.size || 0;
    const langCode = detectedLang ?? lang;
    const langName = LANGS.find((l) => l.code === langCode)?.label ?? langCode;
    const speakerSet = new Set<string>();
    for (const m of text.matchAll(/^Speaker ([A-Z]|\d+):/gm)) {
      speakerSet.add(m[0]);
    }
    const job = addJob({
      id: uid(),
      title,
      transcript: text,
      durationSec: Math.round(durationSec ?? 0),
      language: langCode,
      languageLabel: langName,
      audioUrl: aUrl,
      sizeBytes: size,
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

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const items: QueueItem[] = Array.from(files).map((f) => ({
      id: uid(),
      file: f,
      lang,
      status: "queued",
    }));
    setQueue((q) => [...q, ...items]);
    setQueueFinished(0);
  }

  function updateItemLang(id: string, l: string) {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, lang: l } : it)));
  }

  function removeItem(id: string) {
    setQueue((q) => q.filter((it) => it.id !== id));
  }

  function clearQueue() {
    setQueue([]);
    setQueueFinished(0);
    setCurrentItemId(null);
  }

  async function startQueue() {
    if (queueActive || speech.listening || speech.loading) return;
    const pending = queue.filter((it) => it.status !== "done");
    if (pending.length === 0) return;
    cancelQueueRef.current = false;
    setQueueActive(true);
    setQueueFinished(0);
    setDone(false);
    for (const item of pending) {
      if (cancelQueueRef.current) break;
      setCurrentItemId(item.id);
      setQueue((q) =>
        q.map((it) => (it.id === item.id ? { ...it, status: "processing" } : it))
      );
      const url = URL.createObjectURL(item.file);
      currentFileRef.current = {
        name: item.file.name,
        url,
        size: item.file.size,
      };
      fileUrlRef.current = url;
      fileSizeRef.current = item.file.size;
      try {
        await speech.transcribeFile(item.file, item.lang);
        setQueue((q) =>
          q.map((it) => (it.id === item.id ? { ...it, status: "done" } : it))
        );
        setQueueFinished((c) => c + 1);
      } catch {
        setQueue((q) =>
          q.map((it) => (it.id === item.id ? { ...it, status: "error" } : it))
        );
      }
    }
    setQueueActive(false);
    setCurrentItemId(null);
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
  const remaining = queue.filter((it) => it.status !== "done").length;

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
                Or batch-transcribe audio files (WAV / MP3)
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
                Click to browse — select multiple files
              </div>
              <input
                id="file-input"
                type="file"
                multiple
                accept="audio/wav,audio/mpeg,audio/x-wav,.wav,.mp3"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {queue.length > 0 && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Queue ({queue.length}
                    {queueFinished > 0 ? ` · ${queueFinished} done` : ""})
                  </p>
                  {!queueActive && (
                    <button
                      onClick={clearQueue}
                      className="text-xs text-slate-400 hover:text-rose-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {queue.map((it) => (
                    <div key={it.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2d7ff9] text-white">
                        <IconMic width={16} height={16} />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-medium">
                          {it.file.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(it.file.size / 1024 / 1024).toFixed(1)} MB
                          {it.status === "processing" &&
                            ` · ${speech.fileProgress}%`}
                        </p>
                      </div>
                      <select
                        value={it.lang}
                        disabled={queueActive}
                        onChange={(e) => updateItemLang(it.id, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-1 py-1 text-xs outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        {LANGS.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <Badge tone={STATUS_TONE[it.status]}>
                        {it.status === "processing" && currentItemId === it.id ? (
                          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                        ) : null}
                        {STATUS_LABEL[it.status]}
                      </Badge>
                      {!queueActive && it.status !== "processing" && (
                        <button
                          onClick={() => removeItem(it.id)}
                          className="text-slate-400 hover:text-rose-500"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="brand"
                    disabled={
                      queueActive ||
                      remaining === 0 ||
                      speech.loading ||
                      live
                    }
                    onClick={startQueue}
                  >
                    <IconBolt width={16} height={16} />
                    {queueActive
                      ? "Processing…"
                      : `Transcribe queue (${remaining})`}
                  </Button>
                  {queueActive && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        cancelQueueRef.current = true;
                      }}
                    >
                      <IconStop width={16} height={16} /> Stop
                    </Button>
                  )}
                </div>
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
                    ? `Transcribing ${
                        queueActive
                          ? `queue ${queueFinished + 1}/${queue.length} `
                          : ""
                      }${speech.fileProgress}%`
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
                    : "Record with the microphone or queue WAV/MP3 files to transcribe."}
                </p>
              )}
            </div>

            {done && !queueActive && (
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

        {queueFinished > 0 && !queueActive && (
          <Card className="mt-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Batch complete</p>
              <Badge tone="green">
                <IconCheck width={12} height={12} className="mr-1" />{" "}
                {queueFinished} draft{queueFinished === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              All queued files were transcribed into separate drafts.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="accent"
                onClick={() => router.push("/dashboard")}
              >
                View dashboard
              </Button>
              {jobId && (
                <Button
                  variant="ghost"
                  onClick={() => router.push(`/review?job=${jobId}`)}
                >
                  Review last
                </Button>
              )}
            </div>
          </Card>
        )}

        {done && !queueActive && (
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
