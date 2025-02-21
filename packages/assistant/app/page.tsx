import { ChatInterface } from "@/components/chat-interface"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ModeToggle } from "@/components/mode-toggle"

export default function AssistantPage() {
  return (
    <div className="flex h-screen">
      <ChatSidebar />
      <main className="flex-1 flex flex-col">
        <div className="container py-4">
          <div className="flex justify-between items-center mb-4 px-10">
            <h1 className="text-3xl font-bold text-primary">Akkuea AI Assistant</h1>
            <ModeToggle />
          </div>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-4">
            Your AI-powered assistant for Stellar blockchain development. Ask questions about smart contracts,
            transactions, or project structure.
          </p>
          <ChatInterface />
        </div>
      </main>
    </div>
  )
}

