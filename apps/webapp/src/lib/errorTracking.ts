import * as Sentry from "@sentry/browser";
import { setErrorTrackingProvider } from "@akkuea/shared";

let initialised = false;

/** No-op on the server and when the DSN is empty. Sentry's default handlers cover window.onerror and unhandledrejection. */
export function initWebErrorTracking(): void {
  if (typeof window === "undefined" || initialised) return;
  const dsn = process.env.NEXT_PUBLIC_ERROR_TRACKING_DSN?.trim();
  if (!dsn) return;
  initialised = true;

  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_ERROR_TRACKING_ENVIRONMENT ?? process.env.NODE_ENV,
  });

  setErrorTrackingProvider({
    captureError: (error, context) => {
      Sentry.captureException(error, { extra: context });
    },
    captureMessage: (message, level = "error", context) => {
      Sentry.captureMessage(message, {
        level: level === "warn" ? "warning" : level,
        extra: context,
      });
    },
    setUser: (userId) => Sentry.setUser(userId ? { id: userId } : null),
    flush: async () => {
      await Sentry.flush(2000);
    },
  });
}
