"use client";

import { Topbar } from "@/components/Topbar";
import { Card, Button, Toggle, Badge } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { IconShield, IconBolt, IconMic, IconCheck, IconUsers } from "@/components/icons";
import { useState } from "react";
import { getSpeakerPref, setSpeakerPref } from "@/lib/prefs";

export default function SettingsPage() {
  const { dark, toggle } = useTheme();
  const [browserAuto, setBrowserAuto] = useState(true);
  const [gpu, setGpu] = useState(true);
  const [noise, setNoise] = useState(true);
  const [notif, setNotif] = useState(true);
  const [speakers, setSpeakers] = useState(getSpeakerPref());
  const [langs, setLangs] = useState(["English", "French", "Swahili"]);

  const allLangs = ["English", "French", "Swahili", "Arabic", "German"];

  return (
    <>
      <Topbar title="Settings" />
      <main className="scroll-slim flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <p className="font-semibold">Appearance</p>
            <label className="mt-3 flex items-center justify-between text-sm">
              Dark mode
              <Toggle checked={dark} onChange={toggle} />
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Matches system preference on first launch.
            </p>
          </Card>

          <Card>
            <p className="font-semibold">Transcription engine</p>
            <label className="mt-3 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <IconBolt width={16} height={16} className="text-[#2d7ff9]" /> GPU acceleration
              </span>
              <Toggle checked={gpu} onChange={setGpu} />
            </label>
            <label className="mt-3 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <IconMic width={16} height={16} className="text-[#32d583]" /> Noise reduction
              </span>
              <Toggle checked={noise} onChange={setNoise} />
            </label>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Whisper (14 languages) + NLLB-200 translation
              </p>
          </Card>

          <Card>
            <p className="font-semibold">Intelligence</p>
            <label className="mt-3 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <IconUsers width={16} height={16} className="text-[#2d7ff9]" />
                Speaker recognition
              </span>
              <Toggle
                checked={speakers}
                onChange={(v) => {
                  setSpeakers(v);
                  setSpeakerPref(v);
                }}
              />
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Label each turn (Speaker A / B) using an on-device voice
              embedding model. Defaults to on for new recordings.
            </p>
          </Card>

          <Card>
            <p className="font-semibold">Languages</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enable detection for these languages.
            </p>
            <div className="mt-3 space-y-2">
              {allLangs.map((l) => {
                const on = langs.includes(l);
                return (
                  <label
                    key={l}
                    className="flex items-center justify-between text-sm"
                  >
                    {l}
                    <Toggle
                      checked={on}
                      onChange={() =>
                        setLangs((cur) =>
                          on ? cur.filter((x) => x !== l) : [...cur, l]
                        )
                      }
                    />
                  </label>
                );
              })}
            </div>
          </Card>

          <Card>
            <p className="font-semibold">Browser automation</p>
            <label className="mt-3 flex items-center justify-between text-sm">
              Auto-submit to portal
              <Toggle checked={browserAuto} onChange={setBrowserAuto} />
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Playwright (Chromium) · persistent authenticated sessions.
            </p>

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="font-semibold">Security</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <IconShield width={16} height={16} /> Credentials encrypted with AES (Fernet)
              </div>
              <Button variant="ghost" className="mt-3">
                Reset stored credentials
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <p className="font-semibold">Notifications</p>
            <label className="mt-3 flex items-center justify-between text-sm">
              Job completion alerts
              <Toggle checked={notif} onChange={setNotif} />
            </label>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <IconCheck width={14} height={14} className="text-[#32d583]" />
              All changes are saved locally to this workspace.
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
