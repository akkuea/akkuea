"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";

/** Shared with apps/webapp so a user who switches app keeps their choice. */
export const THEME_STORAGE_KEY = "theme";

const DEFAULT_THEME: Theme = "dark";

/**
 * Runs before first paint, ahead of React, so the correct theme class is on
 * <html> by the time anything renders. Without it the page paints dark and
 * then snaps to light. This is also what makes the class on <html> the
 * single source of truth that `getSnapshot` reads back.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add("${DEFAULT_THEME}");}})();`;

/*
 * The theme lives on <html> as a class, not in React state. That makes it an
 * external store, so it is read with useSyncExternalStore rather than an
 * effect that calls setState. Two things fall out of that: the pre-paint
 * script above and React never disagree about the current theme, and a change
 * made in another tab (or in apps/webapp, which writes the same storage key)
 * propagates here through the storage event.
 */

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("light")
    ? "light"
    : "dark";
}

/*
 * Server render and hydration both use this, so the first client render
 * matches the server output. React then re-reads getSnapshot and re-renders
 * if the stored theme differs, which is the supported flow rather than a
 * hydration mismatch.
 */
function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode, blocked cookies). The theme still
    // applies for this session; only persistence across reloads is lost.
  }
  emit();
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => applyTheme(next), []);
  const toggleTheme = useCallback(
    () => applyTheme(getSnapshot() === "dark" ? "light" : "dark"),
    [],
  );

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
