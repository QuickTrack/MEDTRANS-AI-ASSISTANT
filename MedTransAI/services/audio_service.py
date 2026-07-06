"""
Audio service.

Wraps FFmpeg for: duration detection, format conversion, normalization,
noise reduction and silence trimming. All operations are subprocess-based
and exception-safe. Heavy work should be invoked from background workers.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from config import AppConfig, CONFIG_PATH
from services.logger import get_logger

log = get_logger("audio")


@dataclass
class AudioInfo:
    duration: float
    sample_rate: int
    channels: int
    codec: str


class AudioService:
    def __init__(self, cfg: Optional[AppConfig] = None) -> None:
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self.ffmpeg = self._find_binary("ffmpeg")
        self.ffprobe = self._find_binary("ffprobe")

    @staticmethod
    def _find_binary(name: str) -> str:
        found = shutil.which(name)
        if found:
            return found
        # Common Windows locations
        for cand in (
            Path("C:/ffmpeg/bin") / name,
            Path("C:/Program Files/ffmpeg/bin") / name,
        ):
            if cand.exists():
                return str(cand)
        return name  # rely on PATH at runtime

    def available(self) -> bool:
        try:
            subprocess.run([self.ffmpeg, "-version"], capture_output=True, check=True)
            return True
        except Exception:
            return False

    def probe(self, path: str | Path) -> Optional[AudioInfo]:
        try:
            out = subprocess.run(
                [self.ffprobe, "-v", "quiet", "-print_format", "json",
                 "-show_format", "-show_streams", str(path)],
                capture_output=True, text=True, check=True,
            ).stdout
            data = json.loads(out)
            fmt = data.get("format", {})
            dur = float(fmt.get("duration", 0))
            stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
            return AudioInfo(
                duration=dur,
                sample_rate=int(stream.get("sample_rate", 0)),
                channels=int(stream.get("channels", 0)),
                codec=stream.get("codec_name", ""),
            )
        except Exception as exc:
            log.warning("Audio probe failed for %s: %s", path, exc)
            return None

    def duration(self, path: str | Path) -> float:
        info = self.probe(path)
        return info.duration if info else 0.0

    def convert(
        self,
        src: str | Path,
        dst: str | Path,
        target_format: Optional[str] = None,
        progress_cb: Optional[callable] = None,
    ) -> Path:
        """Convert to a normalized mono 16kHz WAV (default) or target format."""
        cfg = self.cfg.audio
        fmt = target_format or cfg.target_format
        dst = Path(dst)
        dst.parent.mkdir(parents=True, exist_ok=True)

        filters = []
        if cfg.normalize:
            filters.append("loudnorm")
        if cfg.noise_reduction:
            filters.append("afftdn=nr=12:nf=-30")
        if cfg.trim_silence:
            filters.append("silenceremove=start_periods=1:stop_periods=-1:detection=avg")
        filter_chain = ",".join(filters) if filters else "anull"

        cmd = [
            self.ffmpeg, "-y", "-i", str(src),
            "-af", filter_chain,
            "-ar", str(cfg.sample_rate),
            "-ac", "1",
            "-vn",
        ]
        if fmt == "wav":
            cmd += ["-acodec", "pcm_s16le"]
        cmd.append(str(dst))
        log.info("Converting audio %s -> %s", src, dst)
        self._run(cmd, progress_cb)
        return dst

    def extract_audio(self, video_path: str | Path, dst: str | Path) -> Path:
        dst = Path(dst)
        dst.parent.mkdir(parents=True, exist_ok=True)
        cmd = [self.ffmpeg, "-y", "-i", str(video_path), "-vn", "-acodec", "copy", str(dst)]
        self._run(cmd)
        return dst

    def set_speed(self, src: str | Path, dst: str | Path, speed: float) -> Path:
        dst = Path(dst)
        dst.parent.mkdir(parents=True, exist_ok=True)
        atempo = speed if 0.5 <= speed <= 2.0 else 1.0
        cmd = [self.ffmpeg, "-y", "-i", str(src), "-filter:a", f"atempo={atempo}", str(dst)]
        self._run(cmd)
        return dst

    def _run(self, cmd: list[str], progress_cb: Optional[callable] = None) -> None:
        try:
            proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, text=True)
            total_dur = None
            for line in proc.stderr or []:
                if progress_cb and "Duration" in line:
                    pass
            proc.wait(timeout=600)
            if proc.returncode != 0:
                raise RuntimeError(f"FFmpeg exited with code {proc.returncode}")
        except Exception as exc:
            log.error("FFmpeg command failed: %s", exc)
            raise
