"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Catches errors thrown by the root layout itself. Next.js requires this
 * file to render its own <html>/<body>, since it replaces the layout that
 * would normally provide them, so it renders outside the [locale] segment
 * and cannot reach next-intl's request-scoped translations. It stays in
 * English deliberately: this is the last-resort fallback for a failure the
 * app's own locale routing cannot survive.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-land-bg text-land-fg min-h-screen antialiased flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-center gap-4 max-w-md">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-land-fg-muted">
            Akkuea Land ran into an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="bg-land-accent-fill hover:bg-land-accent-fill/90 text-land-on-accent font-bold py-2.5 px-5 rounded-xl text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
