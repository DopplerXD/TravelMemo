import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "travelmemo-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();
let currentTheme: Theme = "light";
let initialized = false;

function systemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function readTheme(): Theme {
  if (typeof document !== "undefined") {
    const attribute = document.documentElement.dataset.theme;
    if (attribute === "light" || attribute === "dark") return attribute;
  }
  return storedTheme() ?? systemTheme();
}

function emit(): void {
  for (const listener of listeners) listener();
}

function paint(theme: Theme): void {
  currentTheme = theme;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#0e1116" : "#f0f2f5";
  emit();
}

export function initTheme(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  paint(readTheme());

  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", (event) => {
    if (storedTheme()) return;
    paint(event.matches ? "dark" : "light");
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    paint(storedTheme() ?? systemTheme());
  });
}

export function getTheme(): Theme {
  return currentTheme;
}

export function setTheme(theme: Theme, persist = true): void {
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in private modes; the session still switches.
    }
  }
  paint(theme);
}

export function toggleTheme(): void {
  setTheme(currentTheme === "dark" ? "light" : "dark");
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);
  return { theme, setTheme, toggleTheme };
}
