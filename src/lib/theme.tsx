"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ThemeState = {
  dark: boolean;
  toggle: () => void;
  setDark: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);
const STORAGE_KEY = "medtrans.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      try {
        if (active) setDarkState(localStorage.getItem(STORAGE_KEY) === "dark");
      } catch {
        /* ignore */
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);

  function toggle() {
    setDarkState((v) => !v);
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle, setDark: setDarkState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
