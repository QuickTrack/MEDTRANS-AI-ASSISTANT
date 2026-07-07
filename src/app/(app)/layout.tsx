"use client";

import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function Gate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc] text-slate-400 dark:bg-[#0b1220]">
        <div className="spinner h-7 w-7 rounded-full border-2 border-slate-300 border-t-[#2d7ff9]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#0b1220]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Gate>{children}</Gate>;
}
