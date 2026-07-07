"use client";

import { useEffect, useState } from "react";

export type JobStatus = "draft" | "review" | "exported";

export type Job = {
  id: string;
  title: string;
  transcript: string;
  durationSec: number;
  language: string;
  languageLabel: string;
  audioUrl: string | null;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  status: JobStatus;
  words: number;
  translation?: string;
  translationLang?: string;
};

const KEY = "medtrans.jobs";
const EVENT = "medtrans:jobs";

function read(): Job[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Job[]) : [];
  } catch {
    return [];
  }
}

function write(jobs: Job[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore quota / serialization errors */
  }
}

function countWords(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function addJob(input: Omit<Job, "words" | "updatedAt" | "status">): Job {
  const job: Job = {
    ...input,
    words: countWords(input.transcript),
    status: "draft",
    updatedAt: Date.now(),
  };
  write([job, ...read()]);
  return job;
}

export function getJob(id: string): Job | null {
  return read().find((j) => j.id === id) ?? null;
}

export function updateJob(id: string, patch: Partial<Omit<Job, "id">>) {
  const jobs = read().map((j) =>
    j.id === id
      ? {
          ...j,
          ...patch,
          words:
            patch.transcript !== undefined
              ? countWords(patch.transcript)
              : j.words,
          updatedAt: Date.now(),
        }
      : j
  );
  write(jobs);
}

export function useJobs(): Job[] {
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    const sync = () => setJobs(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return jobs;
}
