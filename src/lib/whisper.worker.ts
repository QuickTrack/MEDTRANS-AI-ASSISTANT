/// <reference lib="webworker" />

import {
  pipeline,
  env,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

type ProgressInfo = {
  status: string;
  loaded?: number;
  total?: number;
  file?: string;
};

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;

type LangIdResult = { label: string; score: number };
type LangIdPipeline = (
  audio: Float32Array | string,
  opts?: { top_k?: number; sampling_rate?: number }
) => Promise<LangIdResult[]>;

let classifier: LangIdPipeline | null = null;

const LANG_ID_MODEL = "Xenova/w2v-bert-2.0-lang-id";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const envLike = env as unknown as {
  backends?: { onnx?: { wasm?: { numThreads?: number } } };
};
if (envLike.backends?.onnx?.wasm) {
  envLike.backends.onnx.wasm.numThreads = 1;
}

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

function normalize(audio: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < audio.length; i++) peak = Math.max(peak, Math.abs(audio[i]));
  if (peak < 1e-4) return audio;
  const g = 0.95 / peak;
  const out = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) out[i] = audio[i] * g;
  return out;
}

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "init") {
    try {
      transcriber = await pipeline(
        "automatic-speech-recognition",
        (msg.model as string) ?? "Xenova/whisper-base",
        {
          dtype: ((msg.dtype as string) ?? "fp32") as "fp32",
          device: ((msg.device as string) ?? "wasm") as "wasm",
          progress_callback: (p: ProgressInfo) =>
            ctx.postMessage({ type: "progress", ...p }),
        }
      );
      ctx.postMessage({ type: "ready" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.postMessage({ type: "error", message });
    }
    return;
  }

  if (msg.type === "detect") {
    try {
      if (!classifier) {
        const load = (dtype: "q8" | "fp32") =>
          pipeline("audio-classification", LANG_ID_MODEL, {
            dtype,
            device: "wasm",
            progress_callback: (p: ProgressInfo) => {
              if (p.status === "progress" && p.total) {
                ctx.postMessage({
                  type: "detectProgress",
                  loaded: p.loaded ?? 0,
                  total: p.total,
                });
              }
            },
          }) as unknown as LangIdPipeline;
        try {
          classifier = await load("q8");
        } catch {
          classifier = await load("fp32");
        }
      }
      const audio = msg.audio as Float32Array;
      const input = normalize(
        resample(audio, (msg.samplingRate as number) ?? 16000, 16000)
      );
      const results = await classifier(input, {
        top_k: 5,
        sampling_rate: 16000,
      });
      ctx.postMessage({
        type: "detected",
        id: msg.id,
        labels: (results ?? []).map((r) => r.label),
      });
    } catch (err) {
      ctx.postMessage({
        type: "detected",
        id: msg.id,
        label: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === "transcribe") {
    if (!transcriber) {
      ctx.postMessage({ type: "result", id: msg.id, text: "" });
      return;
    }
    const audio = msg.audio as Float32Array;
    const input = resample(
      audio,
      (msg.samplingRate as number) ?? 16000,
      16000
    );
    const wantTs = Boolean(msg.returnTimestamps);
    const opts: Record<string, unknown> = {
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: wantTs,
    };
    if (msg.language) opts.language = msg.language;
    try {
      const out = await transcriber(input, opts);
      const chunks = wantTs
        ? ((out as { chunks?: Array<{ text: string; timestamp: [number, number] }> })
            .chunks ?? []
          ).map((c) => ({
            start: c.timestamp?.[0],
            end: c.timestamp?.[1],
            text: c.text,
          }))
        : [];
      ctx.postMessage({
        type: "result",
        id: msg.id,
        text: (out.text ?? "").trim(),
        chunks,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.postMessage({ type: "error", message });
    }
  }
};
