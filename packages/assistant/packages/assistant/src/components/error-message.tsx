import { AlertCircle } from "lucide-react"

interface ErrorMessageProps {
  error: Error | string
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  const errorMessage = typeof error === "string" ? error : error.message

  return (
    <div className="flex items-start gap-4 max-w-[85%]">
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-red-900 text-white">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div className="rounded-lg px-4 py-3 shadow-sm bg-red-950 text-red-200 border border-red-900">
        <p className="text-sm font-medium">Error: {errorMessage}</p>
        <p className="text-xs mt-1 text-red-300">Please try again or refresh the page.</p>
      </div>
    </div>
  )
}
