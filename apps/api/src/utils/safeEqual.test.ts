import { describe, expect, it } from 'bun:test';
import { safeEqual } from './safeEqual';

describe('safeEqual', () => {
  it('returns true for equal strings', () => {
    expect(safeEqual('test-api-key', 'test-api-key')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(safeEqual('test-api-key', 'test-api-kez')).toBe(false);
  });

  it('returns false for strings of different lengths', () => {
    expect(safeEqual('test-api-key', 'test-api-key-longer')).toBe(false);
    expect(safeEqual('test-api-key', 'test')).toBe(false);
  });

  it('returns false when either string is empty', () => {
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual('', 'test-api-key')).toBe(false);
    expect(safeEqual('test-api-key', '')).toBe(false);
  });

  it('returns false when either value is missing or not a string', () => {
    expect(safeEqual(undefined, 'test-api-key')).toBe(false);
    expect(safeEqual('test-api-key', undefined)).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(false);
    expect(safeEqual(null as unknown as string, 'test-api-key')).toBe(false);
    expect(safeEqual(123 as unknown as string, '123')).toBe(false);
  });

  it('compares unicode strings by their exact content', () => {
    expect(safeEqual('clave-segura-ñandú', 'clave-segura-ñandú')).toBe(true);
    expect(safeEqual('clave-segura-ñandú', 'clave-segura-nandu')).toBe(false);
    // Same characters, different Unicode normalization forms: not equal.
    expect(safeEqual('café', 'café')).toBe(false);
  });
});
