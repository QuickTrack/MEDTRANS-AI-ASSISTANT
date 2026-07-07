"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MODEL = "Xenova/nllb-200-distilled-600M";

type ProgressInfo = {
  status: string;
  loaded?: number;
  total?: number;
};

export function useTranslate() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const readyRef = useRef(false);
  const waitersRef = useRef(new Map<number, (text: string) => void>());
  const initResolveRef = useRef<(() => void) | null>(null);
  const initRejectRef = useRef<((e: unknown) => void) | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("./translate.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (!m || typeof m !== "object") return;
      if (m.type === "progress") {
        const p = m as ProgressInfo;
        if (p.status === "progress" && p.total) {
          setProgress(Math.round(((p.loaded ?? 0) / p.total) * 100));
        }
      } else if (m.type === "ready") {
        readyRef.current = true;
        setReady(true);
        setLoading(false);
        initResolveRef.current?.();
        initResolveRef.current = null;
      } else if (m.type === "error") {
        setError("Translation failed: " + (m.message ?? "unknown error"));
        setLoading(false);
        setTranslating(false);
        initRejectRef.current?.(new Error(m.message ?? "unknown error"));
        initRejectRef.current = null;
      } else if (m.type === "result") {
        setTranslating(false);
        const cb = waitersRef.current.get(m.id);
        if (cb) {
          cb(m.text ?? "");
          waitersRef.current.delete(m.id);
        }
      }
    };
    workerRef.current = w;
    return w;
  }, []);

  const loadModel = useCallback(() => {
    if (readyRef.current) return Promise.resolve();
    setLoading(true);
    setError(null);
    setProgress(0);
    const w = ensureWorker();
    return new Promise<void>((resolve, reject) => {
      initResolveRef.current = resolve;
      initRejectRef.current = reject;
      w.postMessage({ type: "init", model: MODEL, dtype: "q8", device: "wasm" });
    });
  }, [ensureWorker]);

  const translate = useCallback(
    async (text: string, srcLang: string, tgtLang: string): Promise<string> => {
      if (!text.trim()) return "";
      try {
        await loadModel();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError("Translation model failed to load: " + msg);
        return "";
      }
      if (!readyRef.current) {
        setError("Translation model not ready.");
        return "";
      }
      setTranslating(true);
      setError(null);
      const w = ensureWorker();
      const id = ++reqIdRef.current;
      return new Promise<string>((resolve) => {
        waitersRef.current.set(id, resolve);
        w.postMessage({ type: "translate", id, text, srcLang, tgtLang });
      });
    },
    [loadModel, ensureWorker]
  );

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return { loading, ready, progress, translating, error, translate };
}
