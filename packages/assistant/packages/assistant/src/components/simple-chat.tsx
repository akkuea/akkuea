"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function SimpleChat() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Add user message
    const userMessage = { role: "user", content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      // Call the simple API
      const response = await fetch("/api/simple-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      })

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }

      // Check if response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        throw new Error(`Response is not JSON. Content: ${text.substring(0, 100)}...`)
      }

      const data = await response.json()
      setMessages((prev) => [...prev, data])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      console.error("Chat error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center px-4">
          <div className="font-semibold text-white">Simple Chat Test</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 container max-w-4xl mx-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-zinc-400">No messages yet. Send a message to test the API.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.role === "user" ? "bg-turquoise-500 text-black ml-auto" : "bg-zinc-800 text-white"
                } max-w-[80%]`}
              >
                {message.content}
              </div>
            ))}
          </div>
        )}

        {isLoading && <div className="text-zinc-400 mt-4">Loading...</div>}
        {error && <div className="text-red-400 mt-4 p-2 border border-red-800 rounded bg-red-900/20">{error}</div>}
      </div>

      <div className="border-t border-zinc-800 bg-zinc-950 p-4">
        <form onSubmit={handleSubmit} className="container flex gap-2 items-center max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a test message..."
            className="flex-1 px-4 py-3 rounded-full border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-turquoise-500"
          />
          <Button
            type="submit"
            className="rounded-full bg-turquoise-500 hover:bg-turquoise-600 text-black px-6 py-3"
            disabled={isLoading || !input.trim()}
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}
