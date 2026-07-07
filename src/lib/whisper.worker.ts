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
    try {
      const out = await transcriber(input, {
        language: msg.language,
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: wantTs,
      });
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
