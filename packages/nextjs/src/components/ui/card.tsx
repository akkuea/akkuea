import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-lg border border-gray-300 p-4 shadow-sm bg-white dark:bg-black dark:border-gray-800", className)}
      {...props}
    />
  )
}
