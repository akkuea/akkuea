import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SettingsState {
  autoScroll: boolean
  codeTheme: "dark" | "light"
  fontSize: "sm" | "base" | "lg"
  showTimestamps: boolean
  setAutoScroll: (value: boolean) => void
  setCodeTheme: (theme: "dark" | "light") => void
  setFontSize: (size: "sm" | "base" | "lg") => void
  setShowTimestamps: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoScroll: true,
      codeTheme: "dark",
      fontSize: "base",
      showTimestamps: true,
      setAutoScroll: (value) => set({ autoScroll: value }),
      setCodeTheme: (theme) => set({ codeTheme: theme }),
      setFontSize: (size) => set({ fontSize: size }),
      setShowTimestamps: (value) => set({ showTimestamps: value }),
    }),
    {
      name: "akkuea-settings-storage",
    },
  ),
)

