"use client"

import * as React from "react"
import { useChatStore } from "@/store/use-chat-store"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquarePlus, Trash2, MessageSquare, Settings } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ChatSettings } from "./chat-settings"

export function ChatSidebar() {
  const { chatHistory, currentChatId, createNewChat, switchChat, deleteChat } = useChatStore()

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)

  return (
    <div className="w-64 border-r border-border h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {Object.entries(chatHistory).map(([chatId, messages]) => (
            <div
              key={chatId}
              className={`flex items-center justify-between p-2 rounded-lg hover:bg-secondary/10 cursor-pointer ${
                currentChatId === chatId ? "bg-secondary/20" : ""
              }`}
              onClick={() => switchChat(chatId)}
            >
              <div className="flex items-center">
                <MessageSquare className="h-4 w-4 mr-2" />
                <span className="text-sm truncate">{messages[0]?.content.slice(0, 20) || "New Chat"}...</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteChat(chatId)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Chat Settings</SheetTitle>
          </SheetHeader>
          <ChatSettings />
        </SheetContent>
      </Sheet>
    </div>
  )
}

