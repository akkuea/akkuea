import type { Message } from "ai"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bot, User } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { CodeBlock } from "./code-block"

export interface ChatMessageProps {
  message: Message
  isLoading?: boolean
}

export function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const isAI = message.role === "assistant"

  return (
    <div className={cn("flex w-full items-start gap-4 p-4", isAI ? "bg-secondary/5" : "bg-background")}>
      <Avatar className="h-8 w-8">
        {isAI ? (
          <>
            <AvatarImage src="/akkuea-ai-avatar.png" />
            <AvatarFallback>
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src="/user-avatar.png" />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      <Card className={cn("flex-1 px-4 py-2", isAI ? "border-primary/20" : "border-secondary/20")}>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        ) : (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
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
        )}
      </Card>
    </div>
  )
}

