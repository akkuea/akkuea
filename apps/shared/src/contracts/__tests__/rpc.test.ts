import { describe, expect, it, mock } from 'bun:test';
import { callWithRetry, resolveSorobanRpcEndpoints, RpcAllEndpointsFailedError, isRpcAllEndpointsFailedError } from '../rpc.js';

describe('resolveSorobanRpcEndpoints', () => {
  it('returns default testnet endpoints when no overrides', () => {
    const result = resolveSorobanRpcEndpoints('Test SDF Network ; September 2015');
    expect(result.length).toBe(2);
    expect(result[0]).toBe('https://soroban-testnet.stellar.org');
  });

  it('returns default mainnet endpoints for public network', () => {
    const result = resolveSorobanRpcEndpoints('Public Global Stellar Network ; September 2015');
    expect(result.length).toBe(2);
  });

  it('returns explicit rpcUrl when provided', () => {
    const result = resolveSorobanRpcEndpoints('testnet', 'https://custom.rpc');
    expect(result).toEqual(['https://custom.rpc']);
  });

  it('returns rpcUrls when provided', () => {
    const result = resolveSorobanRpcEndpoints('testnet', undefined, ['https://primary', 'https://fallback']);
    expect(result).toEqual(['https://primary', 'https://fallback']);
  });
});

describe('callWithRetry', () => {
  it('returns data on first successful call', async () => {
    const fn = mock(async (_endpoint: string) => 'success');
    const result = await callWithRetry(fn, { endpoints: ['http://primary'], maxRetries: 1 });
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(1);
  });

  it('retries on transient errors and eventually succeeds', async () => {
    let attempts = 0;
    const fn = mock(async (_endpoint: string) => {
      attempts++;
      if (attempts < 2) throw new Error('timeout');
      return 'success';
    });
    const result = await callWithRetry(fn, { endpoints: ['http://primary'], maxRetries: 3, retryBaseDelayMs: 1, maxRetryMs: 100 });
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(2);
  });

  it('throws RpcAllEndpointsFailedError when all retries exhausted', async () => {
    const fn = mock(async () => { throw new Error('timeout'); });
    await expect(
      callWithRetry(fn, { endpoints: ['http://primary'], maxRetries: 2, retryBaseDelayMs: 1, maxRetryMs: 100 })
    ).rejects.toThrow(RpcAllEndpointsFailedError);
  });

  it('does not retry deterministic errors', async () => {
    const fn = mock(async () => {
      throw new Error('contract error: entrypoint not found');
    });
    await expect(
      callWithRetry(fn, { endpoints: ['http://primary'], maxRetries: 3, retryBaseDelayMs: 1, maxRetryMs: 100 })
    ).rejects.toThrow('contract error');
  });

  it('respects maxRetryMs deadline', async () => {
    const fn = mock(async () => { throw new Error('timeout'); });
    await expect(
      callWithRetry(fn, { endpoints: ['http://primary'], maxRetries: 100, retryBaseDelayMs: 1, maxRetryMs: 50 })
    ).rejects.toThrow(RpcAllEndpointsFailedError);
  });
});

describe('RpcAllEndpointsFailedError', () => {
  it('stores errors array', () => {
    const errors = [new Error('err1'), new Error('err2')];
    const err = new RpcAllEndpointsFailedError('all failed', errors);
    expect(err.errors).toEqual(errors);
    expect(err.name).toBe('RpcAllEndpointsFailedError');
  });
});

describe('isRpcAllEndpointsFailedError', () => {
  it('returns true for RpcAllEndpointsFailedError', () => {
    const err = new RpcAllEndpointsFailedError('test', [new Error('x')]);
    expect(isRpcAllEndpointsFailedError(err)).toBe(true);
  });

  it('returns false for regular errors', () => {
    expect(isRpcAllEndpointsFailedError(new Error('normal'))).toBe(false);
  });
});
