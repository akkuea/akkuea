export interface ErrorTrackingEvent {
  message: string;
  level: "error" | "warn" | "info";
  context?: Record<string, unknown>;
  userId?: string;
  tags?: Record<string, string>;
}

export interface ErrorTrackingProvider {
  captureError(error: Error, context?: Record<string, unknown>): void;
  captureMessage(message: string, level?: ErrorTrackingEvent["level"], context?: Record<string, unknown>): void;
  setUser(userId: string | undefined): void;
  flush?(): void | Promise<void>;
}

let provider: ErrorTrackingProvider | null = null;

export function setErrorTrackingProvider(p: ErrorTrackingProvider | null): void {
  provider = p;
}

export function getErrorTrackingProvider(): ErrorTrackingProvider | null {
  return provider;
}

function scrubPii(data: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  const sensitiveKeys = new Set([
    'secret', 'password', 'passphrase', 'admin_secret', 'adminSecret',
    'private_key', 'privateKey', 'sk_', 'x-api-key', 'authorization',
    'wallet_secret', 'signing_payload', 'xdr', 'signed_tx',
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 200) {
      scrubbed[key] = value.slice(0, 200) + '...[truncated]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      scrubbed[key] = scrubPii(value as Record<string, unknown>);
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!provider) return;
  try {
    const scrubbedContext = context ? scrubPii(context) : undefined;
    provider.captureError(error, scrubbedContext);
  } catch {
    // Never let error tracking break application logic
  }
}

export function captureMessage(
  message: string,
  level: ErrorTrackingEvent["level"] = "error",
  context?: Record<string, unknown>,
): void {
  if (!provider) return;
  try {
    const scrubbedContext = context ? scrubPii(context) : undefined;
    provider.captureMessage(message, level, scrubbedContext);
  } catch {
    // Never let error tracking break application logic
  }
}

export function captureErrorSafely(error: unknown, context?: Record<string, unknown>): void {
  if (error instanceof Error) {
    captureError(error, context);
  } else if (error !== null && error !== undefined) {
    captureError(new Error(String(error)), context);
  }
}
