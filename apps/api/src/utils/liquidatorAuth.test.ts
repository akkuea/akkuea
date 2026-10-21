import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { isLiquidatorAuthorized } from './liquidatorAuth';

describe('isLiquidatorAuthorized', () => {
  beforeEach(() => {
    process.env.LIQUIDATOR_API_KEY = 'test-liquidator-key';
  });

  afterEach(() => {
    delete process.env.LIQUIDATOR_API_KEY;
  });

  it('returns false when the header is missing', () => {
    expect(isLiquidatorAuthorized({})).toBe(false);
  });

  it('returns false when the key does not match', () => {
    expect(isLiquidatorAuthorized({ 'x-api-key': 'wrong' })).toBe(false);
  });

  it('returns true when the key matches', () => {
    expect(isLiquidatorAuthorized({ 'x-api-key': 'test-liquidator-key' })).toBe(true);
  });

  it('returns false when LIQUIDATOR_API_KEY is unset', () => {
    delete process.env.LIQUIDATOR_API_KEY;
    expect(isLiquidatorAuthorized({ 'x-api-key': 'test-liquidator-key' })).toBe(false);
  });

  it('returns false when LIQUIDATOR_API_KEY is empty, even for an empty header', () => {
    process.env.LIQUIDATOR_API_KEY = '';
    expect(isLiquidatorAuthorized({ 'x-api-key': '' })).toBe(false);
  });
});
