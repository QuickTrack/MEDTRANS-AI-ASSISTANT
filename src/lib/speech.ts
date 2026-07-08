"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatSegments, type FormatOptions, type Segment } from "./format";
import { pickLanguage, whisperLang } from "./languages";
import { SpeakerRecognizer, type SpeakerStatus } from "./speaker";

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

function rms(audio: Float32Array): number {
  let s = 0;
  for (let i = 0; i < audio.length; i++) s += audio[i] * audio[i];
  return Math.sqrt(s / Math.max(1, audio.length));
}

export function useWhisper(
  lang: string,
  onComplete: (
    text: string,
    audioUrl: string | null,
    sizeBytes: number,
    durationSec?: number,
    detectedLang?: string
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
  const [detecting, setDetecting] = useState(false);
  const [detectProgress, setDetectProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [speakerEnabled, setSpeakerEnabledState] = useState(false);
  const [speakerLoading, setSpeakerLoading] = useState(false);
  const [speakerReady, setSpeakerReady] = useState(false);
  const [speakerProgress, setSpeakerProgress] = useState(0);
  const [speakerError, setSpeakerError] = useState<string | null>(null);

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
  const detectWaitersRef = useRef(new Map<number, (labels: string[]) => void>());
  const detectReqIdRef = useRef(0);
  const detectingGuardRef = useRef(false);
  const detectedLangRef = useRef<string | null>(null);
  const detectedCodeRef = useRef<string | null>(null);
  const finishedRef = useRef(false);

  const speakerRef = useRef<SpeakerRecognizer | null>(null);
  const speakerEnabledRef = useRef(false);
  const segIndexByReqRef = useRef(new Map<number, number>());
  const speakerByReqRef = useRef(new Map<number, string>());

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

  const applyText = useCallback(() => {
    const segs = segmentsRef.current;
    const hasSpeakers = segs.some((s) => s.speaker);
    if (hasSpeakers) {
      setFinalText(
        formatSegments(segs, {
          enabled: true,
          style: "full",
          timestamps: false,
          nonVerbal: true,
          speakers: [],
          autoSpeakers: false,
        })
      );
    } else {
      setFinalText(segs.map((s) => s.text.trim()).join(" ").trim());
    }
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const text = segmentsRef.current
      .map((s) => {
        if (s.speaker) return `${s.speaker}: ${s.text.trim()}`;
        return s.text.trim();
      })
      .join("\n\n")
      .trim();
    const detected =
      langRef.current === "auto"
        ? detectedCodeRef.current ?? undefined
        : langRef.current;
    onCompleteRef.current(
      text,
      audioUrlRef.current,
      sizeRef.current,
      durationRef.current,
      detected
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
      } else if (m.type === "detectProgress") {
        const p = m as ProgressInfo;
        if (p.status === "progress" && p.total) {
          setDetectProgress(Math.round(((p.loaded ?? 0) / p.total) * 100));
        }
      } else if (m.type === "detected") {
        setDetecting(false);
        detectingGuardRef.current = false;
        const cb = detectWaitersRef.current.get(m.id);
        if (cb) {
          cb((m.labels as string[]) ?? []);
          detectWaitersRef.current.delete(m.id);
        }
      } else if (m.type === "result") {
        inflightRef.current = false;
        setTranscribing(false);
        const text = (m.text ?? "").trim();
        if (text) {
          const times = segTimesRef.current.get(m.id);
          segTimesRef.current.delete(m.id);
          const speaker = speakerByReqRef.current.get(m.id);
          segmentsRef.current.push({
            start: times?.start,
            end: times?.end,
            text,
            speaker,
          });
          segIndexByReqRef.current.set(m.id, segmentsRef.current.length - 1);
          applyText();
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
  }, [finish, applyText]);

  const runDetect = useCallback(
    (audio: Float32Array, sr: number): Promise<string[]> => {
      const w = ensureWorker();
      setDetecting(true);
      setDetectProgress(0);
      const id = ++detectReqIdRef.current;
      return new Promise<string[]>((resolve) => {
        detectWaitersRef.current.set(id, resolve);
        w.postMessage({ type: "detect", id, audio, samplingRate: sr }, [
          audio.buffer,
        ]);
      });
    },
    [ensureWorker]
  );

  const detectLang = useCallback((override?: string): string => {
    const effective = override ?? langRef.current;
    if (effective === "auto") {
      return detectedLangRef.current || whisperLang(effective);
    }
    return whisperLang(effective);
  }, []);

  const applySpeaker = useCallback((id: number, label: string) => {
    const idx = segIndexByReqRef.current.get(id);
    if (idx != null && segmentsRef.current[idx]) {
      segmentsRef.current[idx].speaker = label;
      applyText();
    } else {
      speakerByReqRef.current.set(id, label);
    }
  }, [applyText]);

  const ensureSpeaker = useCallback(async (): Promise<boolean> => {
    if (!speakerEnabledRef.current) return false;
    if (!speakerRef.current) {
      const rec = new SpeakerRecognizer();
      rec.onStatus = (s: SpeakerStatus) => {
        setSpeakerLoading(s.loading);
        setSpeakerReady(s.ready);
        setSpeakerProgress(s.progress);
        setSpeakerError(s.error);
      };
      speakerRef.current = rec;
    }
    if (speakerRef.current.ready) return true;
    setSpeakerLoading(true);
    setSpeakerError(null);
    setSpeakerProgress(0);
    try {
      await speakerRef.current.init();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSpeakerError("Speaker model failed to load: " + msg);
      setSpeakerLoading(false);
      return false;
    }
  }, []);

  const setSpeakers = useCallback((enabled: boolean) => {
    speakerEnabledRef.current = enabled;
    setSpeakerEnabledState(enabled);
    if (enabled) {
      ensureSpeaker();
    } else {
      setSpeakerError(null);
    }
  }, [ensureSpeaker]);

  const sendWindow = useCallback(
    async (final: boolean) => {
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

      if (langRef.current === "auto") {
        if (!detectedLangRef.current && !detectingGuardRef.current) {
          if (rms(windowArr) < 0.004) return; // wait for actual speech
          detectingGuardRef.current = true;
          try {
            const labels = await runDetect(windowArr, sr);
            const det = pickLanguage(labels);
            detectedLangRef.current = det ? det.whisper : "";
            detectedCodeRef.current = det ? det.code : "en-US";
          } catch {
            detectedLangRef.current = "";
            detectedCodeRef.current = "en-US";
          }
        } else if (detectingGuardRef.current) {
          // detection still in flight for the first window — skip this one
          return;
        }
      }

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
          language: detectLang() || undefined,
        },
        [windowArr.buffer]
      );
      if (speakerEnabledRef.current && speakerRef.current?.ready) {
        speakerRef.current
          .recognize(windowArr, sr)
          .then((label) => {
            if (label) applySpeaker(id, label);
          })
          .catch(() => undefined);
      }
    },
    [ensureWorker, finish, runDetect, detectLang, applySpeaker]
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
    if (speakerEnabledRef.current) {
      try {
        await ensureSpeaker();
      } catch {
        /* continue without speakers */
      }
    }
    speakerRef.current?.reset();
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
      detectingGuardRef.current = false;
      detectedLangRef.current = null;
      detectedCodeRef.current = null;
      audioUrlRef.current = null;
      sizeRef.current = 0;
      setFinalText("");
      setInterimText("");
      setProgress(0);
      setDetecting(false);
      setDetectProgress(0);

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
  }, [loadModel, sendWindow, finish, ensureSpeaker]);

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
    async (file: File, langOverride?: string) => {
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
      if (speakerEnabledRef.current) {
        try {
          await ensureSpeaker();
        } catch {
          /* continue without speakers */
        }
      }
      speakerRef.current?.reset();
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
      detectingGuardRef.current = false;
      detectedLangRef.current = null;
      detectedCodeRef.current = null;
      setDetecting(false);
      setDetectProgress(0);
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

        if ((langOverride ?? langRef.current) === "auto") {
          const detBuf = mono.slice(0, Math.min(mono.length, sr * 30));
          try {
            const labels = await runDetect(detBuf, sr);
            const det = pickLanguage(labels);
            detectedLangRef.current = det ? det.whisper : "";
            detectedCodeRef.current = det ? det.code : "en-US";
          } catch {
            detectedLangRef.current = "";
            detectedCodeRef.current = "en-US";
          }
        }

        for (let i = 0; i < windows.length; i++) {
          const seg = mono.slice(windows[i].start, windows[i].end);
          const id = ++reqIdRef.current;
          segTimesRef.current.set(id, {
            start: windows[i].start / sr,
            end: windows[i].end / sr,
          });
          const label =
            speakerEnabledRef.current && speakerRef.current?.ready
              ? await speakerRef.current.recognize(seg, sr)
              : "";
          speakerByReqRef.current.set(id, label);
          inflightRef.current = true;
          if (i === windows.length - 1) finalReqIdRef.current = id;
          setTranscribing(true);
          ensureWorker().postMessage(
            {
              type: "transcribe",
              id,
              audio: seg,
              samplingRate: sr,
              language: detectLang(langOverride) || undefined,
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
    [loadModel, ensureWorker, finish, runDetect, detectLang, ensureSpeaker, fileTranscribing]
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
      speakerRef.current = null;
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
    detecting,
    detectProgress,
    transcribing,
    fileTranscribing,
    fileProgress,
    speakerEnabled,
    speakerLoading,
    speakerReady,
    speakerProgress,
    speakerError,
    setSpeakers,
    start,
    stop,
    transcribeFile,
  };
}
