"use client";

const SPEAKER_KEY = "medtrans.speakerRecognition";

export function getSpeakerPref(): boolean {
  try {
    return localStorage.getItem(SPEAKER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSpeakerPref(on: boolean) {
  try {
    if (on) localStorage.setItem(SPEAKER_KEY, "1");
    else localStorage.removeItem(SPEAKER_KEY);
  } catch {
    /* ignore */
  }
}
