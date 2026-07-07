"use client";

import { Topbar } from "@/components/Topbar";
import { Card, StatCard, Sparkline, Badge, Progress } from "@/components/ui";
import {
  IconMic,
  IconCheck,
  IconBolt,
  IconShield,
} from "@/components/icons";
import { useJobs, type Job } from "@/lib/jobs";

const STORAGE_LIMIT = 20 * 1024 * 1024 * 1024; // 20 GB
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusTone(job: Job): "green" | "blue" | "amber" | "rose" {
  if (job.status === "exported") return "green";
  if (job.status === "review") return "blue";
  if (job.transcript.trim()) return "amber";
  return "rose";
}

function statusLabel(job: Job) {
  if (job.status === "exported") return "Completed";
  if (job.status === "review") return "In review";
  if (job.transcript.trim()) return "Drafting";
  return "Empty";
}

export default function DashboardPage() {
  const jobs = useJobs();

  const todayStart = startOfDay(new Date());
  const jobsToday = jobs.filter((j) => j.createdAt >= todayStart);
  const completed = jobs.filter((j) => j.status === "exported");
  const totalMinutes = jobs.reduce((a, j) => a + j.durationSec, 0) / 60;
  const totalWords = jobs.reduce((a, j) => a + j.words, 0);

  const weekly = Array.from({ length: 7 }, (_, i) => {
    const dayStart = startOfDay(new Date()) - (6 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    return jobs.filter(
      (j) => j.createdAt >= dayStart && j.createdAt < dayEnd
    ).length;
  });

  const langMap = new Map<string, number>();
  jobs.forEach((j) => {
    const key = j.languageLabel || j.language;
    langMap.set(key, (langMap.get(key) ?? 0) + 1);
  });
  const langTotal = jobs.length || 1;
  const langs = Array.from(langMap.entries())
    .map(([name, count]) => ({
      name,
      value: Math.round((count / langTotal) * 100),
    }))
    .sort((a, b) => b.value - a.value);

  const storageUsed = jobs.reduce((a, j) => a + (j.sizeBytes || 0), 0);
  const storagePct = Math.min(100, (storageUsed / STORAGE_LIMIT) * 100);

  const recent = [...jobs]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="scroll-slim flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Jobs today"
            value={String(jobsToday.length)}
            delta={
              jobs.length
                ? `${jobs.length} total recorded`
                : "No sessions yet"
            }
            icon={<IconMic width={20} height={20} />}
            accent="#2d7ff9"
          />
          <StatCard
            label="Completed"
            value={String(completed.length)}
            delta={`${jobs.length ? Math.round((completed.length / jobs.length) * 100) : 0}% completion`}
            icon={<IconCheck width={20} height={20} />}
            accent="#32d583"
          />
          <StatCard
            label="Audio processed"
            value={`${totalMinutes.toFixed(1)}m`}
            delta={`${totalWords} words drafted`}
            icon={<IconBolt width={20} height={20} />}
            accent="#2d7ff9"
          />
          <StatCard
            label="Avg length"
            value={
              jobs.length
                ? `${Math.round(
                    jobs.reduce((a, j) => a + j.durationSec, 0) /
                      jobs.length /
                      60
                  )}m`
                : "—"
            }
            delta="Per session"
            icon={<IconShield width={20} height={20} />}
            accent="#32d583"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Weekly throughput</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recorded jobs per day (last 7 days)
                </p>
              </div>
              <Sparkline data={weekly} width={260} height={56} color="#2d7ff9" />
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {weekly.map((v, i) => (
                <div key={i} className="text-center">
                  <div
                    className="mx-auto w-full rounded-lg bg-[#2d7ff9]/15"
                    style={{ height: `${Math.max(v, 0) * 6 + 4}px` }}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    {DAY_LABELS[i]}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="font-semibold">Language mix</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Across {jobs.length || 0} session{jobs.length === 1 ? "" : "s"}
            </p>
            <div className="mt-4 space-y-3">
              {langs.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No sessions recorded yet.
                </p>
              ) : (
                langs.map((l) => (
                  <div key={l.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{l.name}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {l.value}%
                      </span>
                    </div>
                    <Progress value={l.value} />
                  </div>
                ))
              )}
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              Storage used{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {(storageUsed / 1024 / 1024).toFixed(1)} MB
              </span>{" "}
              of 20 GB
              <div className="mt-2">
                <Progress value={storagePct} />
              </div>
            </div>
          </Card>
        </div>

        <Card className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Recent activity</p>
            <Badge tone="blue">Live</Badge>
          </div>
          {recent.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No activity yet — start a recording from the Transcribe tab.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[#2d7ff9]" />
                    <span className="text-sm font-medium">
                      {a.title || "Untitled session"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={statusTone(a)}>{statusLabel(a)}</Badge>
                    <span className="text-xs text-slate-400">
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
