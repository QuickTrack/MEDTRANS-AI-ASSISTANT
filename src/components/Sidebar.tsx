"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconMic,
  IconEdit,
  IconExport,
  IconSettings,
  IconLogo,
} from "./icons";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/transcribe", label: "Transcribe", icon: IconMic },
  { href: "/review", label: "Review", icon: IconEdit },
  { href: "/export", label: "Export", icon: IconExport },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d7ff9] text-white">
          <IconLogo width={20} height={20} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">MedTrans</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            AI Assistant
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors " +
                (active
                  ? "bg-[#2d7ff9]/10 text-[#2d7ff9] dark:bg-[#2d7ff9]/20"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
              }
            >
              <Icon width={18} height={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] text-slate-400">
        v0.1.0 · Local workspace
      </div>
    </aside>
  );
}
