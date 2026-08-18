"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/** Switches between the shared light and dark token sets. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className="flex items-center justify-center h-8 w-8 rounded-lg border border-land-border text-land-fg-muted hover:text-land-fg hover:border-land-border-hover transition-colors"
    >
      {theme === "dark" ? (
        <Sun size={14} aria-hidden="true" />
      ) : (
        <Moon size={14} aria-hidden="true" />
      )}
    </button>
  );
}
