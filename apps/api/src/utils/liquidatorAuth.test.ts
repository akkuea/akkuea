import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { isLiquidatorAuthorized } from './liquidatorAuth';

describe('isLiquidatorAuthorized', () => {
  beforeEach(() => {
    process.env.LIQUIDATOR_API_KEY = 'test-liquidator-key';
  });

  afterEach(() => {
    delete process.env.LIQUIDATOR_API_KEY;
  });

  it('rejects missing, incorrect, or different-length keys', () => {
    expect(isLiquidatorAuthorized({})).toBe(false);
    expect(isLiquidatorAuthorized({ 'x-api-key': 'wrong' })).toBe(false);
    expect(isLiquidatorAuthorized({ 'x-api-key': 'short' })).toBe(false);
  });

  it('accepts the configured key', () => {
    expect(isLiquidatorAuthorized({ 'x-api-key': 'test-liquidator-key' })).toBe(true);
  });
});
