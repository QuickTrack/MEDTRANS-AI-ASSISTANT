"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, Button, Badge, Toggle } from "@/components/ui";
import { IconExport, IconCheck } from "@/components/icons";
import { getJob, updateJob } from "@/lib/jobs";

const FORMATS = [
  { id: "docx", label: "Word (.docx)" },
  { id: "pdf", label: "PDF" },
  { id: "txt", label: "Plain text (.txt)" },
  { id: "json", label: "JSON" },
  { id: "csv", label: "CSV" },
] as const;

function buildContent(
  format: string,
  transcript: string,
  meta: { hospital: string; project: string; date: string }
) {
  const header =
    `MedTrans AI Assistant — Export\n` +
    `Hospital: ${meta.hospital}\n` +
    `Project: ${meta.project}\n` +
    `Date: ${meta.date}\n\n`;

  if (format === "json") {
    return JSON.stringify(
      { ...meta, transcript },
      null,
      2
    );
  }
  if (format === "csv") {
    const rows = transcript
      .split(/\n+/)
      .map((l) => l.replace(/"/g, '""').trim())
      .filter(Boolean)
      .map((l) => `"${l}"`)
      .join("\n");
    return `hospital,project,date,line\n"${meta.hospital}","${meta.project}","${meta.date}"\n${rows}`;
  }
  return header + transcript;
}

function ExportInner() {
  const params = useSearchParams();
  const jobId = params.get("job");

  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("docx");
  const [hospital, setHospital] = useState("St. Mary's General");
  const [project, setProject] = useState("Cardiology Q3");
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [opts, setOpts] = useState({
    footer: true,
    pageNumbers: true,
    logo: true,
    date: true,
  });
  const [done, setDone] = useState(false);
  const loadedRef = useRef<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!jobId || loadedRef.current === jobId) return;
    const job = getJob(jobId);
    loadedRef.current = jobId;
    if (job) {
      setTranscript(job.transcript);
      setTitle(job.title);
      if (job.languageLabel) setProject(job.languageLabel);
    }
  }, [jobId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function exportFile() {
    const date = new Date().toISOString().slice(0, 10);
    const body = buildContent(format, transcript, {
      hospital,
      project,
      date,
    });
    const ext = format === "docx" ? "txt" : format;
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medtrans-${(project || "export")
      .replace(/\s+/g, "-")
      .toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    if (jobId) updateJob(jobId, { status: "exported" });
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }

  return (
    <>
      <Topbar title="Export" />
      <main className="scroll-slim flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Document preview</p>
              {title && <Badge tone="blue">{title}</Badge>}
            </div>
            <pre className="scroll-slim mt-3 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed dark:bg-slate-800/60">
              {transcript ||
                "No transcript loaded. Record and review a session first."}
            </pre>
          </Card>

          <div className="space-y-4">
            <Card>
              <p className="font-semibold">Format</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={
                      "rounded-xl border px-3 py-2 text-sm font-medium transition-colors " +
                      (format === f.id
                        ? "border-[#2d7ff9] bg-[#2d7ff9]/10 text-[#2d7ff9]"
                        : "border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800")
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <p className="font-semibold">Metadata</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Hospital
                  </label>
                  <input
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Project / clip
                  </label>
                  <input
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2d7ff9] dark:border-slate-700 dark:bg-slate-800/60"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <p className="font-semibold">Options</p>
              <div className="mt-3 space-y-3 text-sm">
                {([
                  ["footer", "Footer"],
                  ["pageNumbers", "Page numbers"],
                  ["logo", "Hospital logo"],
                  ["date", "Date stamp"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between">
                    {label}
                    <Toggle
                      checked={opts[key]}
                      onChange={(v) => setOpts((o) => ({ ...o, [key]: v }))}
                    />
                  </label>
                ))}
              </div>
            </Card>

            <Button className="w-full" onClick={exportFile}>
              {done ? (
                <IconCheck width={16} height={16} />
              ) : (
                <IconExport width={16} height={16} />
              )}
              {done ? "Exported" : `Export as ${format.toUpperCase()}`}
            </Button>
            {done && (
              <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">
                Saved to your downloads folder.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={null}>
      <ExportInner />
    </Suspense>
  );
}
