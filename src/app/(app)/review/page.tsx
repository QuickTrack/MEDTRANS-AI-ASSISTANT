"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, Button, Badge } from "@/components/ui";
import { IconCheck, IconExport, IconMic } from "@/components/icons";
import { getJob, updateJob } from "@/lib/jobs";
import { useTranslate } from "@/lib/translate";
import { LANGUAGES, floresLang } from "@/lib/languages";

function ReviewInner() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("job");

  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([""]);
  const [cursor, setCursor] = useState(0);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [targetLang, setTargetLang] = useState("en-US");
  const [srcLang, setSrcLang] = useState("en-US");
  const [translated, setTranslated] = useState("");
  const loadedRef = useRef<string | null>(null);
  const translate = useTranslate();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!jobId || loadedRef.current === jobId) return;
    const job = getJob(jobId);
    loadedRef.current = jobId;
    const t = job?.transcript ?? "";
    setText(t);
    setHistory([t]);
    setCursor(0);
    setAudioUrl(job?.audioUrl ?? null);
    setTitle(job?.title ?? "");
    setTranslated(job?.translation ?? "");
    setTargetLang(job?.translationLang ?? "en-US");
    setSrcLang(job?.language && job.language !== "auto" ? job.language : "en-US");
  }, [jobId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  function persist(next: string) {
    setText(next);
    setHistory((h) => [...h.slice(0, cursor + 1), next]);
    setCursor((c) => c + 1);
    setSaved(false);
    if (jobId) updateJob(jobId, { transcript: next, status: "review" });
  }

  function undo() {
    if (cursor <= 0) return;
    const c = cursor - 1;
    setCursor(c);
    setText(history[c]);
  }
  function redo() {
    if (cursor >= history.length - 1) return;
    const c = cursor + 1;
    setCursor(c);
    setText(history[c]);
  }

  function wrap(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = text.slice(s, e) || "text";
    const next = text.slice(0, s) + before + sel + after + text.slice(e);
    persist(next);
  }

  const matches = search
    ? text.toLowerCase().split(search.toLowerCase()).length - 1
    : 0;

  async function handleTranslate() {
    if (!text.trim() || translate.translating) return;
    const src = floresLang(srcLang);
    const tgt = floresLang(targetLang);
    const out = await translate.translate(text, src, tgt);
    if (out) {
      setTranslated(out);
      if (jobId) updateJob(jobId, { translation: out, translationLang: targetLang });
    }
  }

  return (
    <>
      <Topbar title="Review" />
      <main className="scroll-slim flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => wrap("**")}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-bold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  B
                </button>
                <button
                  onClick={() => wrap("_")}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm italic hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  I
                </button>
                <button
                  onClick={() => wrap("\n- ")}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  • List
                </button>
                <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
                <button
                  onClick={undo}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Undo
                </button>
                <button
                  onClick={redo}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Redo
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
                  />
                  {search && (
                    <span className="text-xs text-slate-400">
                      {matches} found
                    </span>
                  )}
                </div>
              </div>

              <textarea
                ref={ref}
                value={text}
                onChange={(e) => persist(e.target.value)}
                placeholder="Transcript will load here from your recording…"
                className="scroll-slim h-[60vh] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
              />

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {words} words · {text.length} characters · Ctrl+Z undo · Ctrl+F
                  search
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSaved(true);
                      setTimeout(() => setSaved(false), 1500);
                    }}
                  >
                    <IconCheck width={16} height={16} />{" "}
                    {saved ? "Saved" : "Save draft"}
                  </Button>
                  <Button
                    variant="accent"
                    onClick={() => router.push(`/export?job=${jobId ?? ""}`)}
                  >
                    <IconExport width={16} height={16} /> Approve & export
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <p className="flex items-center gap-2 font-semibold">
                <IconMic width={18} height={18} className="text-[#2d7ff9]" />
                Audio compare
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {title || "Original recording"}
              </p>
              {audioUrl ? (
                <audio
                  controls
                  src={audioUrl}
                  className="mt-3 w-full"
                  preload="metadata"
                />
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  No audio attached to this job.
                </p>
              )}
            </Card>

            <Card>
              <p className="font-semibold">Document</p>
              <div className="mt-2 space-y-2 text-sm">
                {[
                  ["Words", words],
                  ["Characters", text.length],
                  ["Saved versions", history.length],
                ].map(([label, val]) => (
                  <div
                    key={label as string}
                    className="flex justify-between text-xs"
                  >
                    <span>{label}</span>
                    <span className="text-slate-400">{val}</span>
                  </div>
                ))}
              </div>
              <Badge tone="blue" className="mt-3">
                {jobId ? "Linked to job" : "No job"}
              </Badge>
            </Card>

            <Card>
              <p className="font-semibold">Translate</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Run a local NLLB translation model over the reviewed text.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={srcLang}
                  onChange={(e) => setSrcLang(e.target.value)}
                  aria-label="Source language"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
                >
                  {LANGUAGES.filter((l) => l.code !== "auto").map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <span className="text-slate-400">→</span>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  aria-label="Target language"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="accent"
                  disabled={translate.translating || !text.trim()}
                  onClick={handleTranslate}
                >
                  {translate.translating
                    ? translate.loading
                      ? `Loading ${translate.progress}%`
                      : "Translating…"
                    : "Translate"}
                </Button>
              </div>
              {translate.error && (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                  {translate.error}
                </p>
              )}
              {translate.loading && !translate.translating && (
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-[#2d7ff9] transition-all"
                      style={{ width: `${translate.progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Downloading translation model ({translate.progress}%) — one-time only
                  </p>
                </div>
              )}
              {translated && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Translation
                  </p>
                  <pre className="scroll-slim max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-800/60">
                    {translated}
                  </pre>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => persist(translated)}
                    >
                      Replace transcript
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => navigator.clipboard?.writeText(translated)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewInner />
    </Suspense>
  );
}
