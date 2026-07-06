"""
AI transcription service built on Faster-Whisper.

Supports GPU (CUDA) with automatic CPU fallback, confidence scoring,
automatic punctuation/capitalization (handled by the model), and medical
terminology post-processing. Designed to run inside a background worker.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Iterator, Optional

from config import AppConfig, CONFIG_PATH
from services.logger import get_logger

log = get_logger("ai")


@dataclass
class Segment:
    start: float
    end: float
    text: str
    confidence: float


@dataclass
class TranscriptionResult:
    text: str
    segments: list[Segment] = field(default_factory=list)
    language: str = ""
    avg_confidence: float = 0.0
    duration: float = 0.0


# Common medical abbreviations expanded for readability (configurable).
MEDICAL_ABBREVIATIONS = {
    r"\bbp\b": "blood pressure",
    r"\bhr\b": "heart rate",
    r"\bbpm\b": "beats per minute",
    r"\btemp\b": "temperature",
    r"\bdx\b": "diagnosis",
    r"\brx\b": "prescription",
    r"\bhx\b": "history",
    r"\bpo\b": "per oral",
    r"\biv\b": "intravenous",
    r"\bsos\b": "save our ship",
}


class TranscribeService:
    def __init__(self, cfg: Optional[AppConfig] = None) -> None:
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self._model = None
        self._model_name = ""

    def _resolve_device(self) -> tuple[str, str]:
        ai = self.cfg.ai
        if ai.device == "auto":
            try:
                import torch  # type: ignore

                if torch.cuda.is_available() and ai.use_cuda:
                    return "cuda", "float16"
            except Exception:
                pass
            return "cpu", "int8"
        return ai.device, ai.compute_type if ai.compute_type != "auto" else (
            "float16" if ai.device == "cuda" else "int8"
        )

    def _load_model(self):
        from faster_whisper import WhisperModel

        ai = self.cfg.ai
        if self._model is None or self._model_name != ai.model_size:
            device, compute = self._resolve_device()
            log.info("Loading Whisper model %s on %s (%s)", ai.model_size, device, compute)
            self._model = WhisperModel(ai.model_size, device=device, compute_type=compute)
            self._model_name = ai.model_size
        return self._model

    def transcribe(
        self,
        audio_path: str,
        progress_cb: Optional[Callable[[float], None]] = None,
        cancel_cb: Optional[Callable[[], bool]] = None,
    ) -> TranscriptionResult:
        model = self._load_model()
        ai = self.cfg.ai
        language = None if ai.language == "auto" else ai.language

        segments_iter: Iterator = model.transcribe(
            audio_path,
            language=language,
            beam_size=ai.beam_size,
            vad_filter=True,
            condition_on_previous_text=True,
        )

        segments: list[Segment] = []
        full_text_parts: list[str] = []
        conf_sum = 0.0
        conf_count = 0
        for seg in segments_iter:
            if cancel_cb and cancel_cb():
                log.info("Transcription cancelled by user.")
                break
            text = seg.text.strip()
            conf = float(getattr(seg, "avg_logprob", -1.0))
            confidence = max(0.0, min(1.0, 1.0 + conf))  # map logprob to 0..1
            segments.append(Segment(start=seg.start, end=seg.end, text=text, confidence=confidence))
            full_text_parts.append(text)
            conf_sum += confidence
            conf_count += 1
            if progress_cb:
                progress_cb(min(1.0, seg.end / max(1.0, segments[-1].end)))

        text = self._post_process(" ".join(full_text_parts))
        avg_conf = (conf_sum / conf_count) if conf_count else 0.0
        return TranscriptionResult(
            text=text,
            segments=segments,
            language=ai.language if ai.language != "auto" else "detected",
            avg_confidence=avg_conf,
            duration=segments[-1].end if segments else 0.0,
        )

    def _post_process(self, text: str) -> str:
        for pattern, replacement in MEDICAL_ABBREVIATIONS.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        # Paragraph detection: split on long pauses already handled by segments;
        # capitalize first letter of sentences.
        text = re.sub(r"(?<=^|[.!?]\s)(\w)", lambda m: m.group(1).upper(), text)
        return text

    def unload(self) -> None:
        self._model = None
