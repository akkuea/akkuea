import * as Sentry from '@sentry/bun';
import { setErrorTrackingProvider } from '@akkuea/shared';

let initialised = false;

/** No-op when ERROR_TRACKING_DSN is empty. */
export function initErrorTracking(): void {
  const dsn = process.env.ERROR_TRACKING_DSN?.trim();
  if (!dsn || initialised) return;
  initialised = true;

  Sentry.init({
    dsn,
    environment:
      process.env.ERROR_TRACKING_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  });

  setErrorTrackingProvider({
    captureError: (error, context) => {
      Sentry.captureException(error, { extra: context });
    },
    captureMessage: (message, level = 'error', context) => {
      Sentry.captureMessage(message, {
        level: level === 'warn' ? 'warning' : level,
        extra: context,
      });
    },
    setUser: (userId) => Sentry.setUser(userId ? { id: userId } : null),
    flush: async () => {
      await Sentry.flush(2000);
    },
  });
}
