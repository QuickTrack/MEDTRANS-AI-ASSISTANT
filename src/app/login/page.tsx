"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button, Toggle } from "@/components/ui";
import {
  IconLogo,
  IconShield,
  IconMoon,
  IconSun,
  IconCheck,
} from "@/components/icons";

export default function LoginPage() {
  const { user, login } = useAuth();
  const { dark, toggle } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("dr.ame@hospital.org");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [autoLogin, setAutoLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      login(email, email.split("@")[0].replace(/^[a-z]/, (c) => c.toUpperCase()), remember);
      router.replace("/dashboard");
    }, 650);
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#eef4ff] to-[#f8fafc] dark:from-[#0b1220] dark:to-[#0b1220]">
      <div className="m-auto w-full max-w-sm px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2d7ff9] text-white">
                <IconLogo width={24} height={24} />
              </div>
              <div>
                <p className="text-base font-bold leading-tight">
                  MedTrans AI
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Assistant
                </p>
              </div>
            </div>
            <button
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {dark ? (
                <IconSun width={18} height={18} />
              ) : (
                <IconMoon width={18} height={18} />
              )}
            </button>
          </div>

          <h1 className="text-xl font-bold tracking-tight">
            Sign in to your workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Encrypted, local-first medical transcription.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#2d7ff9] focus:ring-2 focus:ring-[#2d7ff9]/20 dark:border-slate-700 dark:bg-slate-800/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#2d7ff9] focus:ring-2 focus:ring-[#2d7ff9]/20 dark:border-slate-700 dark:bg-slate-800/60"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <Toggle checked={remember} onChange={setRemember} />
                Remember me
              </label>
              <label className="flex items-center gap-2">
                <Toggle checked={autoLogin} onChange={setAutoLogin} />
                Auto login
              </label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <IconShield width={16} height={16} />
            Credentials are encrypted with AES (Fernet) — never stored as plaintext.
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            <IconCheck width={12} height={12} className="mr-1 inline" />
            Demo workspace · any credentials are accepted
          </p>
        </div>
      </div>
    </div>
  );
}
