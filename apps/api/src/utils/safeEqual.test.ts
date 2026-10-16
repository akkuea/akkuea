import { describe, expect, it } from 'bun:test';
import { safeEqual } from './safeEqual';

describe('safeEqual', () => {
  it('returns true for matching strings', () => {
    expect(safeEqual('secret', 'secret')).toBe(true);
  });

  it('returns false for different strings and different lengths', () => {
    expect(safeEqual('secret', 'secreu')).toBe(false);
    expect(safeEqual('secret', 'short')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});
