/// <reference lib="webworker" />

import { pipeline, env } from "@huggingface/transformers";

const MODEL = "Xenova/nllb-200-distilled-600M";

type ProgressLike = { status: string; loaded?: number; total?: number };

type Translator = (
  text: string,
  opts: { src_lang: string; tgt_lang: string }
) => Promise<{ translation_text?: string } | Array<{ translation_text?: string }>>;

let translator: Translator | null = null;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const envLike = env as unknown as {
  backends?: { onnx?: { wasm?: { numThreads?: number } } };
};
if (envLike.backends?.onnx?.wasm) {
  envLike.backends.onnx.wasm.numThreads = 1;
}

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "init") {
    try {
      translator = (await pipeline("translation", MODEL, {
        dtype: ((msg.dtype as string) ?? "q8") as "q8",
        device: ((msg.device as string) ?? "wasm") as "wasm",
        // Skip layout optimizations: the bundled onnxruntime-web dev build fails in
        // TransposeDQWeightsForMatMulNBits on the dynamically-fused quantized weights.
        session_options: { graphOptimizationLevel: "basic" },
        progress_callback: (p: ProgressLike) => {
          if (p.status === "progress" && p.total) {
            ctx.postMessage({ type: "progress", loaded: p.loaded ?? 0, total: p.total });
          }
        },
      })) as Translator;
      ctx.postMessage({ type: "ready" });
    } catch (err) {
      ctx.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === "translate") {
    if (!translator) {
      ctx.postMessage({ type: "result", id: msg.id, text: "" });
      return;
    }
    try {
      const out = await translator(msg.text as string, {
        src_lang: msg.srcLang as string,
        tgt_lang: msg.tgtLang as string,
      });
      const text = Array.isArray(out)
        ? (out[0]?.translation_text ?? "")
        : (out.translation_text ?? "");
      ctx.postMessage({ type: "result", id: msg.id, text });
    } catch (err) {
      ctx.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
