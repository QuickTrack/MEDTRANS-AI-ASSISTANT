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
