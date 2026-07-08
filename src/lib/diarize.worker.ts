/// <reference lib="webworker" />

import {
  pipeline,
  env,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

type ProgressInfo = {
  status: string;
  loaded?: number;
  total?: number;
  file?: string;
};

let extractor: FeatureExtractionPipeline | null = null;

const MODEL = "Xenova/wav2vec2-base-superb-sv";

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

function toEmbedding(out: unknown): number[] {
  const o = out as {
    embeddings?: { data?: Float32Array };
    embedding?: { data?: Float32Array };
    last_hidden_state?: { data?: Float32Array; dims?: number[] };
  };
  if (o.embeddings?.data) return Array.from(o.embeddings.data);
  if (o.embedding?.data) return Array.from(o.embedding.data);
  if (o.last_hidden_state?.data && o.last_hidden_state.dims) {
    const [b, t, d] = o.last_hidden_state.dims;
    const data = o.last_hidden_state.data;
    const pooled = new Float32Array(d);
    for (let i = 0; i < t; i++) {
      for (let j = 0; j < d; j++) pooled[j] += data[i * d + j];
    }
    for (let j = 0; j < d; j++) pooled[j] /= t;
    return Array.from(pooled);
  }
  return [];
}

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "init") {
    try {
      const load = (dtype: "q8" | "fp32") =>
        pipeline("feature-extraction", (msg.model as string) ?? MODEL, {
          dtype,
          device: "wasm",
          progress_callback: (p: ProgressInfo) =>
            ctx.postMessage({ type: "progress", ...p }),
        }) as unknown as FeatureExtractionPipeline;
      try {
        extractor = await load("q8");
      } catch {
        extractor = await load("fp32");
      }
      ctx.postMessage({ type: "ready" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.postMessage({ type: "error", message });
    }
    return;
  }

  if (msg.type === "embed") {
    if (!extractor) {
      ctx.postMessage({ type: "embedded", id: msg.id, embeddings: [] });
      return;
    }
    try {
      const chunks = (msg.audioChunks as Float32Array[]) ?? [];
      const sr = (msg.samplingRate as number) ?? 16000;
      const embeddings: number[][] = [];
      for (const chunk of chunks) {
        const input = resample(chunk, sr, 16000);
        if (rms(input) < 1e-3) {
          embeddings.push([]);
          continue;
        }
        const out = await (extractor as unknown as (
          input: Float32Array,
          opts: Record<string, unknown>
        ) => Promise<unknown>)(input, {
          pooling: "mean",
          normalize: true,
        });
        embeddings.push(toEmbedding(out));
      }
      ctx.postMessage({ type: "embedded", id: msg.id, embeddings });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.postMessage({ type: "error", message });
    }
  }
};
