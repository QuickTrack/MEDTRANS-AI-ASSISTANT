"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatSegments, type FormatOptions, type Segment } from "./format";
import { whisperLang } from "./languages";

type ProgressInfo = {
  status: string;
  loaded?: number;
  total?: number;
  file?: string;
};

const MODEL = "Xenova/whisper-base";

const WINDOW_MS = 6000;
const OVERLAP_MS = 1500;
const MAX_SAMPLES = 600 * 48000; // cap ~10 min @ 48k

function appendFloat(target: Float32Array, add: Float32Array, maxLen: number) {
  const next = new Float32Array(target.length + add.length);
  next.set(target, 0);
  next.set(add, target.length);
  if (next.length > maxLen) return next.slice(next.length - maxLen);
  return next;
}

export function useWhisper(
  lang: string,
  onComplete: (
    text: string,
    audioUrl: string | null,
    sizeBytes: number,
    durationSec?: number
  ) => void,
  formatOpts?: FormatOptions
) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [fileTranscribing, setFileTranscribing] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const inflightRef = useRef(false);
  const processedUntilRef = useRef(0);
  const finalReqIdRef = useRef<number | null>(null);
  const canFinishRef = useRef(false);
  const durationRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);
  const sizeRef = useRef(0);
  const modelReadyRef = useRef(false);
  const initResolveRef = useRef<(() => void) | null>(null);
  const initRejectRef = useRef<((e: unknown) => void) | null>(null);
  const resultWaitersRef = useRef(new Map<number, () => void>());
  const finishedRef = useRef(false);

  const segmentsRef = useRef<Segment[]>([]);
  const segTimesRef = useRef(new Map<number, { start?: number; end?: number }>());
  const formatOptsRef = useRef<FormatOptions | undefined>(formatOpts);
  useEffect(() => {
    formatOptsRef.current = formatOpts;
  }, [formatOpts]);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<Float32Array>(new Float32Array(0));
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listeningRef = useRef(false);
  const langRef = useRef(lang);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    langRef.current = lang;
    onCompleteRef.current = onComplete;
  });

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const opts = formatOptsRef.current;
    const text = opts
      ? formatSegments(segmentsRef.current, opts)
      : segmentsRef.current.map((s) => s.text.trim()).join(" ").trim();
    onCompleteRef.current(
      text,
      audioUrlRef.current,
      sizeRef.current,
      durationRef.current
    );
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
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
        modelReadyRef.current = true;
        setReady(true);
        setLoading(false);
        initResolveRef.current?.();
        initResolveRef.current = null;
      } else if (m.type === "error") {
        setError("Transcription failed: " + (m.message ?? "unknown error"));
        setLoading(false);
        initRejectRef.current?.(new Error(m.message ?? "unknown error"));
        initRejectRef.current = null;
      } else if (m.type === "result") {
        inflightRef.current = false;
        setTranscribing(false);
        const text = (m.text ?? "").trim();
        if (text) {
          const times = segTimesRef.current.get(m.id);
          segTimesRef.current.delete(m.id);
          segmentsRef.current.push({
            start: times?.start,
            end: times?.end,
            text,
          });
          const opts = formatOptsRef.current;
          setFinalText(
            opts
              ? formatSegments(segmentsRef.current, opts)
              : segmentsRef.current.map((s) => s.text.trim()).join(" ").trim()
          );
        }
        resultWaitersRef.current.get(m.id)?.();
        resultWaitersRef.current.delete(m.id);
        if (m.id === finalReqIdRef.current) {
          finalReqIdRef.current = null;
          if (canFinishRef.current) finish();
        }
      }
    };
    workerRef.current = w;
    return w;
  }, [finish]);

  const sendWindow = useCallback(
    (final: boolean) => {
      const buf = audioRef.current;
      const ctx = ctxRef.current;
      if (!ctx || !buf || buf.length <= processedUntilRef.current) {
        if (final) {
          finalReqIdRef.current = null;
          if (canFinishRef.current) finish();
        }
        return;
      }
      const sr = ctx.sampleRate;
      const overlap = Math.min(
        processedUntilRef.current,
        Math.floor((sr * OVERLAP_MS) / 1000)
      );
      const startIdx = Math.max(0, processedUntilRef.current - overlap);
      const windowArr = buf.slice(startIdx, buf.length);
      const id = ++reqIdRef.current;
      inflightRef.current = true;
      if (final) finalReqIdRef.current = id;
      processedUntilRef.current = buf.length;
      const w = ensureWorker();
      setTranscribing(true);
      w.postMessage(
        {
          type: "transcribe",
          id,
          audio: windowArr,
          samplingRate: sr,
          language: whisperLang(langRef.current),
        },
        [windowArr.buffer]
      );
    },
    [ensureWorker, finish]
  );

  const loadModel = useCallback(() => {
    if (modelReadyRef.current) return Promise.resolve();
    setLoading(true);
    setError(null);
    setProgress(0);
    const w = ensureWorker();
    return new Promise<void>((resolve, reject) => {
      initResolveRef.current = resolve;
      initRejectRef.current = reject;
      w.postMessage({ type: "init", model: MODEL, dtype: "fp32", device: "wasm" });
    });
  }, [ensureWorker]);

  const start = useCallback(async () => {
    if (listeningRef.current) return;
    try {
      await loadModel();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("Model failed to load: " + msg);
      setLoading(false);
      return;
    }
    if (!modelReadyRef.current) {
      setError("Model not ready — cannot start transcription.");
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      ctxRef.current = ctx;

      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 2.6));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        audioUrlRef.current = URL.createObjectURL(blob);
        sizeRef.current = blob.size;
        canFinishRef.current = true;
        if (finalReqIdRef.current === null) finish();
      };
      rec.start();
      recorderRef.current = rec;

      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (ev: AudioProcessingEvent) => {
        const input = ev.inputBuffer.getChannelData(0);
        audioRef.current = appendFloat(
          audioRef.current,
          new Float32Array(input),
          MAX_SAMPLES
        );
      };
      const silent = ctx.createGain();
      silent.gain.value = 0;
      src.connect(proc);
      proc.connect(silent);
      silent.connect(ctx.destination);
      procRef.current = proc;

      audioRef.current = new Float32Array(0);
      segmentsRef.current = [];
      segTimesRef.current = new Map();
      processedUntilRef.current = 0;
      finalReqIdRef.current = null;
      canFinishRef.current = false;
      finishedRef.current = false;
      audioUrlRef.current = null;
      sizeRef.current = 0;
      setFinalText("");
      setInterimText("");
      setProgress(0);

      listeningRef.current = true;
      setListening(true);

      timerRef.current = setInterval(() => {
        if (!inflightRef.current) sendWindow(false);
      }, WINDOW_MS);
    } catch {
      setError("Microphone access was denied or is unavailable.");
      setListening(false);
      listeningRef.current = false;
    }
  }, [loadModel, sendWindow, finish]);

  const stop = useCallback(() => {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    setListening(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (audioRef.current.length > processedUntilRef.current) {
      sendWindow(true);
    } else {
      finalReqIdRef.current = null;
      if (canFinishRef.current) finish();
    }

    recorderRef.current?.stop();
    recorderRef.current = null;
    procRef.current?.disconnect();
    procRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setLevel(0);
  }, [sendWindow, finish]);

  const transcribeFile = useCallback(
    async (file: File) => {
      if (listeningRef.current || fileTranscribing) return;
      try {
        await loadModel();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError("Model failed to load: " + msg);
        return;
      }
      if (!modelReadyRef.current) {
        setError("Model not ready — cannot start transcription.");
        return;
      }
      setError(null);
      setFileTranscribing(true);
      setFileProgress(0);
      setFinalText("");
      setInterimText("");
      segmentsRef.current = [];
      segTimesRef.current = new Map();
      finalReqIdRef.current = null;
      canFinishRef.current = true;
      finishedRef.current = false;
      audioUrlRef.current = URL.createObjectURL(file);
      sizeRef.current = file.size;

      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const ac = new Ctor();
        const audioBuffer = await ac.decodeAudioData(arrayBuffer);
        durationRef.current = audioBuffer.duration;
        const sr = audioBuffer.sampleRate;
        const channels = audioBuffer.numberOfChannels;
        const total = audioBuffer.length;
        const mono = new Float32Array(total);
        for (let c = 0; c < channels; c++) {
          const data = audioBuffer.getChannelData(c);
          for (let i = 0; i < total; i++) mono[i] += data[i] / channels;
        }
        ac.close().catch(() => undefined);

        const windowSamples = Math.floor(sr * 30);
        const step = windowSamples;
        const windows: Array<{ start: number; end: number }> = [];
        for (let start = 0; start < total; start += step) {
          const end = Math.min(total, start + windowSamples);
          windows.push({ start, end });
          if (end >= total) break;
        }
        if (windows.length === 0) windows.push({ start: 0, end: total });

        for (let i = 0; i < windows.length; i++) {
          const seg = mono.slice(windows[i].start, windows[i].end);
          const id = ++reqIdRef.current;
          segTimesRef.current.set(id, {
            start: windows[i].start / sr,
            end: windows[i].end / sr,
          });
          inflightRef.current = true;
          if (i === windows.length - 1) finalReqIdRef.current = id;
          setTranscribing(true);
          ensureWorker().postMessage(
            {
              type: "transcribe",
              id,
              audio: seg,
              samplingRate: sr,
              language: whisperLang(langRef.current),
            },
            [seg.buffer]
          );
          setFileProgress(Math.round(((i + 1) / windows.length) * 100));
          await new Promise<void>((resolve) => {
            resultWaitersRef.current.set(id, resolve);
          });
          if (listeningRef.current) break; // aborted by starting a live session
        }
      } catch {
        setError("Could not decode this audio file (WAV/MP3 supported).");
      } finally {
        setFileTranscribing(false);
        setTranscribing(false);
        if (canFinishRef.current && finalReqIdRef.current === null) {
          finish();
        }
      }
    },
    [loadModel, ensureWorker, finish, fileTranscribing]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stop();
      procRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => undefined);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return {
    supported: true,
    loading,
    ready,
    progress,
    listening,
    finalText,
    interimText,
    level,
    error,
    transcribing,
    fileTranscribing,
    fileProgress,
    start,
    stop,
    transcribeFile,
  };
}
