import type { Message } from "ai"
import { cn } from "@/lib/utils"
import { CodeBlock } from "./code-block"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bot, User } from "lucide-react"

export interface ChatMessageProps {
  message: Message
  isLoading?: boolean
}

export function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const isAI = message.role === "assistant"

  return (
    <div className={cn("flex w-full items-start gap-3 sm:gap-4", isAI ? "bg-secondary/5" : "bg-background")}>
      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 mt-0.5 sm:mt-0">
        {isAI ? (
          <>
            <AvatarImage src="/akkuea-ai-avatar.png" />
            <AvatarFallback>
              <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src="/user-avatar.png" />
            <AvatarFallback>
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      <Card className={cn("flex-1 px-3 py-2 sm:px-4 sm:py-3", isAI ? "border-primary/20" : "border-secondary/20")}>
        <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base">
          {message.content.split("```").map((part, index) => {
            if (index % 2 === 0) {
              return (
                <div key={index} className="whitespace-pre-wrap">
                  {part}
                </div>
              )
            } else {
              const [language, ...code] = part.split("\n")
              return <CodeBlock key={index} language={(language || "typescript").trim()} code={code.join("\n")} />
            }
          })}
        </div>
      </Card>
    </div>
  )
}

