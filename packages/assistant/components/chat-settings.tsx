"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSettingsStore } from "@/store/use-settings-store"

export function ChatSettings() {
  const {
    autoScroll,
    codeTheme,
    fontSize,
    showTimestamps,
    setAutoScroll,
    setCodeTheme,
    setFontSize,
    setShowTimestamps,
  } = useSettingsStore()

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="auto-scroll">Auto-scroll to bottom</Label>
        <Switch id="auto-scroll" checked={autoScroll} onCheckedChange={setAutoScroll} />
      </div>

      <div className="space-y-2">
        <Label>Code Theme</Label>
        <Select value={codeTheme} onValueChange={(value: "dark" | "light") => setCodeTheme(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Font Size</Label>
        <Select value={fontSize} onValueChange={(value: "sm" | "base" | "lg") => setFontSize(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="base">Medium</SelectItem>
            <SelectItem value="lg">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="show-timestamps">Show timestamps</Label>
        <Switch id="show-timestamps" checked={showTimestamps} onCheckedChange={setShowTimestamps} />
      </div>
    </div>
  )
}

