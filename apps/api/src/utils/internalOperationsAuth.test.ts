import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { isInternalOperationsAuthorized } from './internalOperationsAuth';

describe('isInternalOperationsAuthorized', () => {
  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-internal-ops-key';
  });

  afterEach(() => {
    delete process.env.OPERATIONS_BACKEND_CREDENTIAL;
  });

  it('returns false when the header is missing', () => {
    expect(isInternalOperationsAuthorized({})).toBe(false);
  });

  it('returns false when the key does not match', () => {
    expect(isInternalOperationsAuthorized({ 'x-internal-api-key': 'wrong' })).toBe(false);
  });

  it('returns true when the key matches', () => {
    expect(isInternalOperationsAuthorized({ 'x-internal-api-key': 'test-internal-ops-key' })).toBe(
      true,
    );
  });

  it('returns false when OPERATIONS_BACKEND_CREDENTIAL is unset', () => {
    delete process.env.OPERATIONS_BACKEND_CREDENTIAL;
    expect(isInternalOperationsAuthorized({ 'x-internal-api-key': 'test-internal-ops-key' })).toBe(
      false,
    );
  });
});
