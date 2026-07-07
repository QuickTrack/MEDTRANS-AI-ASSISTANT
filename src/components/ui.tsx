import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm " +
        "dark:border-slate-800 dark:bg-slate-900/60 " +
        className
      }
    >
      {children}
    </div>
  );
}

type Variant = "brand" | "accent" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  brand:
    "bg-[#2d7ff9] text-white hover:bg-[#1f5fd1] disabled:opacity-50",
  accent:
    "bg-[#32d583] text-white hover:bg-[#28b86f] disabled:opacity-50",
  ghost:
    "bg-transparent text-slate-600 border border-slate-200 hover:bg-slate-100 " +
    "dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800",
  danger:
    "bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50",
};

export function Button({
  children,
  variant = "brand",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold " +
        "transition-colors disabled:cursor-not-allowed " +
        variants[variant] +
        " " +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "blue" | "amber" | "rose";
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
        tones[tone] +
        " " +
        className
      }
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  accent = "#2d7ff9",
}: {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {delta && (
          <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {delta}
          </p>
        )}
      </div>
      {icon && (
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: accent + "1a", color: accent }}
        >
          {icon}
        </div>
      )}
    </Card>
  );
}

export function Sparkline({
  data,
  color = "#2d7ff9",
  width = 120,
  height = 36,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d - min) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div
        className="h-full rounded-full bg-[#2d7ff9] transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
        (checked ? "bg-[#2d7ff9]" : "bg-slate-300 dark:bg-slate-700")
      }
      aria-pressed={checked}
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-5" : "translate-x-0.5")
        }
      />
    </button>
  );
}
