export type Language = {
  code: string;
  label: string;
  whisper: string;
  flores: string;
};

export const LANGUAGES: Language[] = [
  { code: "auto", label: "Auto-detect", whisper: "", flores: "eng_Latn" },
  { code: "en-US", label: "English", whisper: "english", flores: "eng_Latn" },
  { code: "fr-FR", label: "French", whisper: "french", flores: "fra_Latn" },
  { code: "es-ES", label: "Spanish", whisper: "spanish", flores: "spa_Latn" },
  { code: "de-DE", label: "German", whisper: "german", flores: "deu_Latn" },
  { code: "it-IT", label: "Italian", whisper: "italian", flores: "ita_Latn" },
  { code: "pt-PT", label: "Portuguese", whisper: "portuguese", flores: "por_Latn" },
  { code: "ar-SA", label: "Arabic", whisper: "arabic", flores: "arb_Arab" },
  { code: "sw-KE", label: "Swahili", whisper: "swahili", flores: "swh_Latn" },
  { code: "hi-IN", label: "Hindi", whisper: "hindi", flores: "hin_Deva" },
  { code: "ru-RU", label: "Russian", whisper: "russian", flores: "rus_Cyrl" },
  { code: "zh-CN", label: "Chinese", whisper: "chinese", flores: "zho_Hans" },
  { code: "ja-JP", label: "Japanese", whisper: "japanese", flores: "jpn_Jpan" },
  { code: "nl-NL", label: "Dutch", whisper: "dutch", flores: "nld_Latn" },
  { code: "tr-TR", label: "Turkish", whisper: "turkish", flores: "tur_Latn" },
];

export const LANG_BY_CODE: Record<string, Language> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l])
);

export function whisperLang(code: string): string {
  return LANG_BY_CODE[code]?.whisper ?? "english";
}

export function floresLang(code: string): string {
  return LANG_BY_CODE[code]?.flores ?? "eng_Latn";
}

const ALIAS_LIST: Array<[string, string[]]> = [
  ["en-US", ["eng_latn", "eng", "en"]],
  ["fr-FR", ["fra_latn", "fra", "fr", "fre"]],
  ["es-ES", ["spa_latn", "spa", "es"]],
  ["de-DE", ["deu_latn", "deu", "de", "ger"]],
  ["it-IT", ["ita_latn", "ita", "it"]],
  ["pt-PT", ["por_latn", "por", "pt"]],
  ["ar-SA", ["arb_arab", "arb", "ar", "ara"]],
  ["sw-KE", ["swh_latn", "swh", "sw", "swa"]],
  ["hi-IN", ["hin_deva", "hin", "hi"]],
  ["ru-RU", ["rus_cyrl", "rus", "ru"]],
  ["zh-CN", ["zho_hans", "zho", "zh", "chi"]],
  ["ja-JP", ["jpn_jpan", "jpn", "ja"]],
  ["nl-NL", ["nld_latn", "nld", "nl", "dut"]],
  ["tr-TR", ["tur_latn", "tur", "tr"]],
];

const ALIASES: Record<string, string> = {};
for (const [code, aliases] of ALIAS_LIST) {
  for (const a of aliases) ALIASES[a] = code;
}

export function languageFromFlores(flores: string): Language | null {
  const raw = (flores ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return null;
  const byCode = (c: string) => (ALIASES[c] ? LANG_BY_CODE[ALIASES[c]] ?? null : null);
  return (
    byCode(raw) ??
    byCode(raw.replace(/_/g, "")) ??
    byCode(raw.split("_")[0]) ??
    null
  );
}

export function pickLanguage(labels: string[]): Language | null {
  for (const l of labels ?? []) {
    const lang = languageFromFlores(l);
    if (lang && lang.code !== "auto") return lang;
  }
  return null;
}
