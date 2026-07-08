"use client";

const MODEL = "Xenova/wav2vec2-base-960h";
const CHUNK_SEC = 3;
const MAX_SPEAKERS = 6;
const SIM_THRESHOLD = 0.6;

export type SpeakerStatus = {
  loading: boolean;
  ready: boolean;
  progress: number;
  error: string | null;
};

function resample(audio: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate || !audio.length) return audio;
  const ratio = fromRate / toRate;
  const newLen = Math.max(1, Math.round(audio.length / ratio));
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(audio.length - 1, i0 + 1);
    const frac = idx - i0;
    out[i] = audio[i0] * (1 - frac) + audio[i1] * frac;
  }
  return out;
}

function rms(audio: Float32Array): number {
  let s = 0;
  for (let i = 0; i < audio.length; i++) s += audio[i] * audio[i];
  return Math.sqrt(s / Math.max(1, audio.length));
}

function chunkify(audio: Float32Array, chunkSamples: number): Float32Array[] {
  const out: Float32Array[] = [];
  for (let i = 0; i < audio.length; i += chunkSamples) {
    out.push(audio.slice(i, Math.min(audio.length, i + chunkSamples)));
  }
  if (out.length === 0) out.push(audio);
  return out;
}

function labelFor(index: number): string {
  return index < 26
    ? `Speaker ${String.fromCharCode(65 + index)}`
    : `Speaker ${index + 1}`;
}

export class SpeakerRecognizer {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private resolveInit: (() => void) | null = null;
  private rejectInit: ((e: unknown) => void) | null = null;

  private centroids: number[][] = [];
  private counts: number[] = [];
  private lastSpeaker = "";
  private embedReq = 0;
  private embedWaiters = new Map<number, (e: number[][]) => void>();

  private status: SpeakerStatus = {
    loading: false,
    ready: false,
    progress: 0,
    error: null,
  };
  onStatus: ((s: SpeakerStatus) => void) | null = null;

  get ready() {
    return this.status.ready;
  }

  private emit() {
    this.onStatus?.({ ...this.status });
  }

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.status = { loading: true, ready: false, progress: 0, error: null };
    this.emit();
    this.worker = new Worker(new URL("./diarize.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (!m || typeof m !== "object") return;
      if (m.type === "progress") {
        if (m.status === "progress" && m.total) {
          this.status.progress = Math.round((m.loaded / m.total) * 100);
          this.emit();
        }
      } else if (m.type === "ready") {
        this.status = { ...this.status, loading: false, ready: true };
        this.emit();
        this.resolveInit?.();
        this.resolveInit = null;
      } else if (m.type === "error") {
        this.status = {
          ...this.status,
          loading: false,
          error: m.message ?? "unknown error",
        };
        this.emit();
        this.rejectInit?.(new Error(m.message ?? "unknown error"));
        this.rejectInit = null;
      } else if (m.type === "embedded") {
        const cb = this.embedWaiters.get(m.id);
        if (cb) {
          cb((m.embeddings as number[][]) ?? []);
          this.embedWaiters.delete(m.id);
        }
      }
    };
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.resolveInit = resolve;
      this.rejectInit = reject;
      this.worker!.postMessage({ type: "init", model: MODEL });
    });
    return this.initPromise;
  }

  reset() {
    this.centroids = [];
    this.counts = [];
    this.lastSpeaker = "";
  }

  private embedChunks(chunks: Float32Array[]): Promise<number[][]> {
    const w = this.worker;
    if (!w) return Promise.resolve(chunks.map(() => []));
    const id = ++this.embedReq;
    return new Promise<number[][]>((resolve) => {
      this.embedWaiters.set(id, resolve);
      w.postMessage(
        { type: "embed", id, audioChunks: chunks, samplingRate: 16000 },
        chunks.map((c) => c.buffer)
      );
    });
  }

  private assign(emb: number[]): string {
    if (emb.length === 0) return this.lastSpeaker;
    if (this.centroids.length === 0) {
      this.centroids.push(emb);
      this.counts.push(1);
      this.lastSpeaker = labelFor(0);
      return this.lastSpeaker;
    }
    let best = -1;
    let bestSim = -Infinity;
    for (let i = 0; i < this.centroids.length; i++) {
      const c = this.centroids[i];
      let dot = 0;
      const n = Math.min(c.length, emb.length);
      for (let j = 0; j < n; j++) dot += c[j] * emb[j];
      if (dot > bestSim) {
        bestSim = dot;
        best = i;
      }
    }
    if (bestSim >= SIM_THRESHOLD) {
      const total = this.counts[best] + 1;
      const c = this.centroids[best];
      for (let j = 0; j < c.length; j++) {
        c[j] = (c[j] * this.counts[best] + emb[j]) / total;
      }
      this.counts[best] = total;
      this.lastSpeaker = labelFor(best);
      return this.lastSpeaker;
    }
    if (this.centroids.length < MAX_SPEAKERS) {
      this.centroids.push(emb);
      this.counts.push(1);
      this.lastSpeaker = labelFor(this.centroids.length - 1);
      return this.lastSpeaker;
    }
    this.lastSpeaker = labelFor(best);
    return this.lastSpeaker;
  }

  async recognize(audio: Float32Array, sr: number): Promise<string> {
    if (!this.ready) return "";
    const resampled = resample(audio, sr, 16000);
    const chunks = chunkify(resampled, CHUNK_SEC * 16000).filter(
      (c) => rms(c) > 0.008
    );
    if (chunks.length === 0) return this.lastSpeaker;
    const embs = await this.embedChunks(chunks);
    const tally: Record<string, number> = {};
    let chosen = "";
    let bestCount = -1;
    for (const e of embs) {
      if (e.length === 0) continue;
      const label = this.assign(e);
      tally[label] = (tally[label] ?? 0) + 1;
    }
    for (const [label, count] of Object.entries(tally)) {
      if (count > bestCount) {
        bestCount = count;
        chosen = label;
      }
    }
    return chosen || this.lastSpeaker;
  }
}
