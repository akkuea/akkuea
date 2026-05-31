/**
 * MSW initializer for the Next.js App Router.
 *
 * Usage: Call `initMocks()` once at application startup in a Client Component.
 * This is a no-op in Node.js (SSR/SSG) because the Service Worker API is
 * not available there — MSW's browser integration is client-only.
 *
 * The function is dynamic-imported so the MSW bundle is never included in
 * the server build (tree-shaken when USE_MOCK is false).
 */
export async function initMocks(): Promise<void> {
  if (typeof window === "undefined") {
    // Server environment — nothing to do.
    return;
  }

  const { worker } = await import("./browser");

  await worker.start({
    // Suppress "unhandled request" warnings for Next.js internals (_next/*)
    onUnhandledRequest(req, print) {
      const url = new URL(req.url);

      // Ignore Next.js internal requests
      if (
        url.pathname.startsWith("/_next") ||
        url.pathname.startsWith("/__nextjs") ||
        url.pathname === "/favicon.ico" ||
        url.pathname.endsWith(".png") ||
        url.pathname.endsWith(".jpg") ||
        url.pathname.endsWith(".svg") ||
        url.pathname.endsWith(".webp") ||
        url.pathname.endsWith(".css") ||
        url.pathname.endsWith(".js")
      ) {
        return;
      }

      // Print warning for any unhandled API request
      print.warning();
    },
  });

  if (process.env.NODE_ENV === "development") {
    console.info(
      "[MSW] Mock Service Worker started. All API calls are intercepted.",
    );
  }
}
