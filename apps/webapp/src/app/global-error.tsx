"use client";

import { useEffect } from "react";
import { captureErrorSafely } from "@akkuea/shared";
import { initWebErrorTracking } from "@/lib/errorTracking";

// The root layout (and its ErrorTrackingInit) may be what crashed, so
// initialise here as well. initWebErrorTracking is idempotent.
initWebErrorTracking();

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
    captureErrorSafely(error, {
      context: "webapp-global-error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <h2>Something went wrong</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
