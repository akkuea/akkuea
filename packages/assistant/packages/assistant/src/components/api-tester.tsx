"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function ApiTester() {
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testApi = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/test")
      const data = await response.json()
      setTestResult(JSON.stringify(data, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      console.error("API test error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const testChatApi = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "test message",
            },
          ],
        }),
      })

      // Check if response is JSON
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json()
        setTestResult(JSON.stringify(data, null, 2))
      } else {
        // If not JSON, get text
        const text = await response.text()
        setError(`Response is not JSON. Status: ${response.status}. Content: ${text.substring(0, 100)}...`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      console.error("Chat API test error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 p-4 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg w-80">
      <h3 className="font-medium text-white mb-4">API Tester</h3>

      <div className="space-y-2">
        <Button variant="outline" size="sm" className="w-full border-zinc-800" onClick={testApi} disabled={isLoading}>
          Test /api/test
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="w-full border-zinc-800"
          onClick={testChatApi}
          disabled={isLoading}
        >
          Test Chat API
        </Button>
      </div>

      {isLoading && <p className="text-sm text-zinc-400 mt-2">Loading...</p>}

      {error && (
        <div className="mt-2 p-2 bg-red-900/20 border border-red-900 rounded text-xs text-red-400 overflow-auto max-h-40">
          {error}
        </div>
      )}

      {testResult && (
        <div className="mt-2 p-2 bg-zinc-800 rounded text-xs text-zinc-300 overflow-auto max-h-40">
          <pre>{testResult}</pre>
        </div>
      )}
    </div>
  )
}
