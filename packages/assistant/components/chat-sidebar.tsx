"use client"

import * as React from "react"
import { useChatStore } from "@/store/use-chat-store"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquarePlus, Trash2, MessageSquare, Settings, Clock } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ChatSettings } from "./chat-settings"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export function ChatSidebar() {
  const { chatHistory, currentChatId, createNewChat, switchChat, deleteChat } = useChatStore()

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)

  const formatChatTitle = (messages: any[]) => {
    if (!messages.length) return "New Chat"
    const firstMessage = messages[0].content
    return firstMessage.length > 30 ? firstMessage.substring(0, 30) + "..." : firstMessage
  }

  return (
    <div className="w-[300px] h-full flex flex-col bg-background border-r">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4 pt-10">
          <Button variant="outline" className="w-full" onClick={createNewChat}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={() => setIsSettingsOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {Object.entries(chatHistory).map(([chatId, messages]) => {
            const isActive = currentChatId === chatId
            const timestamp = new Date(Number.parseInt(chatId))

            return (
              <div
                key={chatId}
                className={cn(
                  "group flex flex-col gap-1 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-secondary/20" : "hover:bg-secondary/10 cursor-pointer",
                )}
                onClick={() => switchChat(chatId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">{formatChatTitle(messages)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteChat(chatId)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(timestamp, "MMM d, yyyy")}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetContent side="right" className="sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>Chat Settings</SheetTitle>
          </SheetHeader>
          <ChatSettings />
        </SheetContent>
      </Sheet>
    </div>
  )
}

