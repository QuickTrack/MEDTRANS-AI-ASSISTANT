"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import {
  IconSearch,
  IconSun,
  IconMoon,
  IconLogout,
  IconShield,
} from "./icons";
import { Badge } from "./ui";

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [menu, setMenu] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/50">
      <div>
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Medical transcription workspace
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 md:flex">
          <IconSearch width={16} height={16} />
          <input
            placeholder="Search jobs, drafts…"
            className="w-44 bg-transparent outline-none placeholder:text-slate-400"
          />
        </div>

        <Badge tone="green">
          <IconShield width={12} height={12} className="mr-1" /> Encrypted
        </Badge>

        <button
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Toggle theme"
        >
          {dark ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2d7ff9] text-xs font-bold text-white">
              {(user?.name || "U").charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-sm font-medium sm:block">
              {user?.name || "User"}
            </span>
          </button>

          {menu && (
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <IconLogout width={16} height={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
