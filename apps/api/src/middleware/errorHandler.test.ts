import { afterEach, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { setErrorTrackingProvider, type ErrorTrackingProvider } from '@akkuea/shared';
import { ApiError } from '../errors/ApiError';
import { errorHandler } from './errorHandler';

describe('errorHandler middleware', () => {
  afterEach(() => {
    setErrorTrackingProvider(null);
  });

  it('reports handler errors to the configured error tracking provider', async () => {
    const provider: ErrorTrackingProvider = {
      captureError: mock(),
      captureMessage: mock(),
      setUser: mock(),
    };
    setErrorTrackingProvider(provider);

    const app = new Elysia().use(errorHandler).get('/boom', () => {
      throw new ApiError(500, 'INTERNAL_ERROR', 'boom');
    });

    const response = await app.handle(new Request('http://localhost:3001/boom'));
    await response.text();

    expect(response.status).toBe(500);
    expect(provider.captureError).toHaveBeenCalledTimes(1);
    const call = (provider.captureError as ReturnType<typeof mock>).mock.calls[0]!;
    expect(call[0].message).toBe('boom');
    expect(call[1].context).toBe('api-error-handler');
  });
});
