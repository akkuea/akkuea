import { ChatInterface } from "@/components/chat-interface"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export default function AssistantPage() {
  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <ChatSidebar />
      </div>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden fixed left-4 top-4 z-30">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] p-0">
          <ChatSidebar />
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col pt-10">
        <div className="container py-2 sm:py-4">
          <div className="flex justify-between items-center mb-2 sm:mb-4 px-2 md:px-8">
            <h1 className="text-xl sm:text-3xl font-bold text-primary truncate">
              <span className="hidden sm:inline">Akkuea AI Assistant</span>
              <span className="sm:hidden">Assistant</span>
            </h1>
            <ModeToggle />
          </div>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-2 sm:mb-4 text-sm sm:text-base hidden sm:block">
            Your AI-powered assistant for Stellar blockchain development. Ask questions about smart contracts,
            transactions, or project structure.
          </p>
       <div className="px-2 md:px-8">
       <ChatInterface />
       </div>
        </div>
      </main>
    </div>
  )
}

