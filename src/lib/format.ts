export type FormatOptions = {
  enabled: boolean;
  style: "clean" | "full";
  timestamps: boolean;
  nonVerbal: boolean;
  speakers: string[];
  autoSpeakers: boolean;
};

export type Segment = {
  start?: number;
  end?: number;
  text: string;
};

const FILLERS = new Set([
  "um",
  "uh",
  "er",
  "ah",
  "mm",
  "hmm",
  "hm",
  "uhh",
  "umm",
  "eh",
  "like",
  "you know",
  "i mean",
  "well",
  "so",
  "actually",
  "basically",
  "literally",
]);

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function stripFillers(text: string): string {
  return text
    .replace(/\b(um+|uh+|er+|ah+|mm+|hmm+|hm+|uhh+|umm+|eh+)\b/gi, " ")
    .replace(/\b(like|you know|i mean|well|so|actually|basically|literally)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function stripCues(text: string): string {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function formatSegments(segments: Segment[], opts: FormatOptions): string {
  if (!opts.enabled || segments.length === 0) {
    const joined = segments.map((s) => s.text.trim()).join(" ").trim();
    return opts.style === "clean" ? stripFillers(joined) : joined;
  }

  const labels = opts.speakers.length ? opts.speakers : ["Speaker 1"];
  const out: string[] = [];
  let speakerIdx = 0;
  let prevEnd: number | null = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    let t = seg.text.trim();
    if (!t) continue;
    if (opts.style === "clean") t = stripFillers(t);
    if (!opts.nonVerbal) t = stripCues(t);
    if (!t) continue;

    if (opts.autoSpeakers && labels.length > 1 && prevEnd != null && seg.start != null) {
      if (seg.start - prevEnd > 1.2) {
        speakerIdx = (speakerIdx + 1) % labels.length;
      }
    }

    const label = labels[speakerIdx % labels.length];
    const ts =
      opts.timestamps && seg.start != null
        ? `[${fmtTime(seg.start)}] `
        : "";
    out.push(`${label}: ${ts}${t}`);

    if (seg.end != null) prevEnd = seg.end;
  }

  return out.join("\n\n");
}
