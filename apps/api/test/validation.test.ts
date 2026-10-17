import { describe, it, expect } from 'bun:test';
import { ValidationService } from '../src/utils/validation';

describe('ValidationService', () => {
  const validValuation = {
    propertyId: 'prop-1',
    price: 100000,
    confidence: 0.9,
    timestamp: new Date().toISOString(),
    source: 'oracle',
  };

  const validPropertyInfo = {
    name: 'Test Property',
    location: 'Test City',
    totalValue: 100000,
    totalShares: 100,
    pricePerShare: 1000,
  };

  const validTransaction = {
    from: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    to: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    amount: 100,
    asset: 'XLM',
  };

  const validLendingPool = {
    name: 'Test Pool',
    assetAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    owner: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    interestRate: 5,
    totalLiquidity: 100000,
  };

  describe('validateValuationPayload', () => {
    it('accepts a valid payload', () => {
      const result = ValidationService.validateValuationPayload(validValuation);
      expect(result.isValid).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = ValidationService.validateValuationPayload({});
      expect(result.isValid).toBe(false);
    });

    it('rejects a non-date timestamp', () => {
      const result = ValidationService.validateValuationPayload({
        ...validValuation,
        timestamp: 'not-a-date',
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects NaN price', () => {
      const result = ValidationService.validateValuationPayload({
        ...validValuation,
        price: NaN,
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects non-numeric price string', () => {
      const result = ValidationService.validateValuationPayload({
        ...validValuation,
        price: 'abc',
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects NaN confidence', () => {
      const result = ValidationService.validateValuationPayload({
        ...validValuation,
        confidence: NaN,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePropertyInfo', () => {
    it('accepts valid info', () => {
      const result = ValidationService.validatePropertyInfo(validPropertyInfo);
      expect(result.isValid).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = ValidationService.validatePropertyInfo({});
      expect(result.isValid).toBe(false);
    });

    it('rejects non-numeric pricePerShare', () => {
      const result = ValidationService.validatePropertyInfo({
        ...validPropertyInfo,
        pricePerShare: 'abc',
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateTransaction', () => {
    it('accepts a valid transaction', () => {
      const result = ValidationService.validateTransaction(validTransaction);
      expect(result.isValid).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = ValidationService.validateTransaction({});
      expect(result.isValid).toBe(false);
    });

    it('rejects non-numeric amount', () => {
      const result = ValidationService.validateTransaction({
        ...validTransaction,
        amount: 'abc',
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects Infinity amount', () => {
      const result = ValidationService.validateTransaction({
        ...validTransaction,
        amount: 'Infinity',
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateLendingPool', () => {
    it('accepts a valid C... contract asset address', () => {
      const result = ValidationService.validateLendingPool(validLendingPool);
      expect(result.isValid).toBe(true);
    });

    it('rejects a malformed asset address', () => {
      const result = ValidationService.validateLendingPool({
        ...validLendingPool,
        assetAddress: 'not-a-contract',
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateStellarAddress', () => {
    it('accepts a valid G... account', () => {
      const result = ValidationService.validateStellarAddress(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      );
      expect(result.isValid).toBe(true);
    });

    it('rejects a C... contract address', () => {
      const result = ValidationService.validateStellarAddress(
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      );
      expect(result.isValid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('trims and strips control characters', () => {
      expect(ValidationService.sanitizeString('  hello\u0000world  ')).toBe('helloworld');
    });

    it('returns empty string for non-string input', () => {
      expect(ValidationService.sanitizeString(undefined as unknown as string)).toBe('');
    });
  });
});
