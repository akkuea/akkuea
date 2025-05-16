"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "ai/react"
import { Send, Bot, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/assistant/chat",
    onError: (error) => {
      console.error("Chat error:", error)
    },
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Prevent hydration issues
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Bot className="h-5 w-5 text-turquoise-500" />
            <span>Development Assistant</span>
          </div>
        </div>
      </header>

      {/* Chat container */}
      <div className="flex-1 overflow-y-auto p-4 container max-w-4xl mx-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
            <Bot className="h-12 w-12 text-turquoise-500" />
            <h2 className="text-2xl font-bold tracking-tight text-white">Development Assistant</h2>
            <p className="text-zinc-400 max-w-sm">
              Ask me about code, frameworks, best practices, debugging, or any development-related questions.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex items-start gap-4 max-w-[85%]", message.role === "user" ? "ml-auto" : "")}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-white",
                    message.role === "user" ? "bg-turquoise-500 ml-2 order-2" : "bg-zinc-800",
                  )}
                >
                  {message.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 shadow-sm",
                    message.role === "user"
                      ? "bg-turquoise-500 text-black"
                      : "bg-zinc-900 text-zinc-100 border border-zinc-800",
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-4 max-w-[85%]">
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-zinc-800 text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="rounded-lg px-4 py-3 shadow-sm bg-zinc-900 text-zinc-100 border border-zinc-800">
                  <Loader2 className="h-5 w-5 animate-spin text-turquoise-500" />
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-4 max-w-[85%]">
                <div className="rounded-lg px-4 py-3 shadow-sm bg-red-900 text-red-100 border border-red-800">
                  Error: {error.message || "Something went wrong"}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-800 bg-zinc-950 p-4">
        <form onSubmit={handleSubmit} className="container flex gap-2 items-center max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a development question..."
            className="flex-1 px-4 py-3 rounded-full border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-turquoise-500 focus:border-transparent"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full bg-turquoise-500 hover:bg-turquoise-600 text-black h-12 w-12"
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  )
}
