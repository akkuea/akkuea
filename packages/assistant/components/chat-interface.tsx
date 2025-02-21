"use client"

import * as React from "react"
import { useChat } from "ai/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ChatMessage } from "./chat-message"
import { Send, Loader2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useChatStore } from "@/store/use-chat-store"
import { useSettingsStore } from "@/store/use-settings-store"

export function ChatInterface() {
  const [isErrorOpen, setIsErrorOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")

  const { messages, setMessages, addMessage } = useChatStore()
  const { autoScroll, fontSize } = useSettingsStore()

  const { input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    initialMessages: messages,
    onResponse: (response) => {
      if (!response.ok) {
        setErrorMessage("An error occurred while fetching the response.")
        setIsErrorOpen(true)
      }
    },
    onFinish: (message) => {
      addMessage(message)
    },
  })

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [autoScroll])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto h-[85vh] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full bg-primary animate-pulse bg-green-600`} />
            Akkuea AI Assistant
          </CardTitle>
          <Separator />
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div
              className={cn("space-y-4", {
                "text-sm": fontSize === "sm",
                "text-base": fontSize === "base",
                "text-lg": fontSize === "lg",
              })}
            >
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLoading={isLoading && index === messages.length - 1}
                />
              ))}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>
        </CardContent>

        <CardFooter>
          <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Stellar development, smart contracts, or project structure... (Press Enter to send, Shift+Enter for new line)"
              className="flex-1 min-h-[60px] max-h-[200px]"
              // autoResize
              disabled={isLoading}
              rows={1}
            />
            <Button type="submit" disabled={isLoading} className="mb-[3px]">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </CardFooter>
      </Card>

      <AlertDialog open={isErrorOpen} onOpenChange={setIsErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => setIsErrorOpen(false)}>Close</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

