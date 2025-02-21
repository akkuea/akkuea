import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Message } from "ai"

interface ChatState {
  messages: Message[]
  chatHistory: { [key: string]: Message[] }
  currentChatId: string | null
  addMessage: (message: Message) => void
  setMessages: (messages: Message[]) => void
  createNewChat: () => void
  switchChat: (chatId: string) => void
  deleteChat: (chatId: string) => void
  clearCurrentChat: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      chatHistory: {},
      currentChatId: null,
      addMessage: (message) => {
        const { currentChatId, chatHistory } = get()
        if (!currentChatId) return

        const updatedMessages = [...get().messages, message]
        set({
          messages: updatedMessages,
          chatHistory: {
            ...chatHistory,
            [currentChatId]: updatedMessages,
          },
        })
      },
      setMessages: (messages) => {
        const { currentChatId, chatHistory } = get()
        if (!currentChatId) return

        set({
          messages,
          chatHistory: {
            ...chatHistory,
            [currentChatId]: messages,
          },
        })
      },
      createNewChat: () => {
        const newChatId = Date.now().toString()
        set((state) => ({
          currentChatId: newChatId,
          messages: [],
          chatHistory: {
            ...state.chatHistory,
            [newChatId]: [],
          },
        }))
      },
      switchChat: (chatId) => {
        const { chatHistory } = get()
        if (chatHistory[chatId]) {
          set({
            currentChatId: chatId,
            messages: chatHistory[chatId],
          })
        }
      },
      deleteChat: (chatId) => {
        const { chatHistory, currentChatId } = get()
        const newHistory = { ...chatHistory }
        delete newHistory[chatId]

        set({
          chatHistory: newHistory,
          ...(currentChatId === chatId
            ? {
                currentChatId: null,
                messages: [],
              }
            : {}),
        })
      },
      clearCurrentChat: () => {
        const { currentChatId, chatHistory } = get()
        if (!currentChatId) return

        set({
          messages: [],
          chatHistory: {
            ...chatHistory,
            [currentChatId]: [],
          },
        })
      },
    }),
    {
      name: "akkuea-chat-storage",
    },
  ),
)

