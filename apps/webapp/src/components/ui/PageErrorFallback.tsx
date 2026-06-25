"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { fadeInUp } from "@/lib/animations";

interface PageErrorFallbackProps {
  /** Called when the user clicks "Try again". */
  onReset?: () => void;
}

/**
 * A branded, full-section error fallback matching the app's dark design
 * language. Shown when an error boundary catches a render-time crash.
 *
 * - No stack traces or internal error messages exposed to the user.
 * - "Try again" resets the error boundary; "Go to Home" navigates to `/`.
 */
export function PageErrorFallback({ onReset }: PageErrorFallbackProps) {
  const router = useRouter();

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
    >
      {/* Icon container */}
      <div className="w-16 h-16 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
      </div>

      {/* Heading */}
      <h2 className="text-2xl font-bold text-white mb-3">
        Something went wrong
      </h2>

      {/* Description */}
      <p className="text-sm text-neutral-500 max-w-md mb-8">
        We encountered an unexpected error. Please try again or navigate to
        another page.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {onReset && (
          <Button
            variant="accent"
            onClick={onReset}
            leftIcon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
          >
            Try again
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          leftIcon={<Home className="w-4 h-4" aria-hidden="true" />}
        >
          Go to Home
        </Button>
      </div>
    </motion.div>
  );
}
