import { describe, expect, it, mock } from 'bun:test';
import {
  setErrorTrackingProvider,
  captureError,
  captureMessage,
  captureErrorSafely,
} from '../errorTracking.js';

describe('errorTracking', () => {
  beforeEach(() => {
    setErrorTrackingProvider(null);
  });

  afterEach(() => {
    setErrorTrackingProvider(null);
  });

  it('is a no-op when no provider is configured', () => {
    expect(() => captureError(new Error('test'))).not.toThrow();
    expect(() => captureMessage('test')).not.toThrow();
  });

  it('captures errors when provider is set', () => {
    const provider = {
      captureError: mock(),
      captureMessage: mock(),
    };
    setErrorTrackingProvider(provider as any);

    const error = new Error('test error');
    captureError(error, { context: 'test' });
    expect(provider.captureError).toHaveBeenCalled();
  });

  it('scrubs PII and sensitive keys', () => {
    const provider = {
      captureError: mock(),
      captureMessage: mock(),
    };
    setErrorTrackingProvider(provider as any);

    const error = new Error('test');
    captureError(error, {
      secret: 'should-be-redacted',
      walletSecret: 'also-redacted',
      xdr: 'xdr-data-should-be-truncated',
      safeKey: 'safe value',
    });

    const call = (provider.captureError as ReturnType<typeof mock>).mock.calls[0];
    const context = call[1];
    expect(context.secret).toBe('[REDACTED]');
    expect(context.walletSecret).toBe('[REDACTED]');
    expect(context.xdr).toContain('[truncated]');
    expect(context.safeKey).toBe('safe value');
  });

  it('captureErrorSafely handles non-Error values', () => {
    const provider = {
      captureError: mock(),
    };
    setErrorTrackingProvider(provider as any);

    captureErrorSafely('not an error', { context: 'test' });
    expect(provider.captureError).toHaveBeenCalled();
  });

  it('captureErrorSafely handles null safely', () => {
    const provider = {
      captureError: mock(),
    };
    setErrorTrackingProvider(provider as any);

    expect(() => captureErrorSafely(null)).not.toThrow();
    expect(() => captureErrorSafely(undefined)).not.toThrow();
  });

  it('does not throw if provider has an error', () => {
    const provider = {
      captureError: mock(() => { throw new Error('provider broken'); }),
    };
    setErrorTrackingProvider(provider as any);

    expect(() => captureError(new Error('test'))).not.toThrow();
  });
});
