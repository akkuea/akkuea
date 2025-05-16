"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState<"unknown" | "success" | "error">("unknown")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const checkApiConnection = async () => {
    try {
      setApiStatus("unknown")
      setErrorMessage(null)

      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "Test message",
            },
          ],
        }),
      })

      if (response.ok) {
        setApiStatus("success")
      } else {
        const data = await response.json().catch(() => ({ error: "Failed to parse response" }))
        setApiStatus("error")
        setErrorMessage(data.error || `Error ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      setApiStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred")
    }
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 bg-zinc-900 border-zinc-800 text-zinc-400"
        onClick={() => setIsOpen(true)}
      >
        Debug
      </Button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg w-80">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-white">Debug Panel</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-zinc-400 mb-1">API Connection:</p>
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                apiStatus === "unknown" ? "bg-zinc-500" : apiStatus === "success" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-zinc-300">
              {apiStatus === "unknown" ? "Not tested" : apiStatus === "success" ? "Connected" : "Failed"}
            </span>
          </div>
          {errorMessage && <p className="text-xs text-red-400 mt-1 break-words">{errorMessage}</p>}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full border-zinc-800 hover:border-turquoise-500"
          onClick={checkApiConnection}
        >
          Test API Connection
        </Button>

        <div className="text-xs text-zinc-500">
          <p>Environment:</p>
          <p>Next.js: {process.env.NEXT_PUBLIC_VERCEL_ENV || "development"}</p>
          <p>API Key: {process.env.OPENAI_API_KEY ? "Configured" : "Not configured"}</p>
        </div>
      </div>
    </div>
  )
}
