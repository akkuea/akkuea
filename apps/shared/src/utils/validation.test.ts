import { describe, expect, it } from 'bun:test';
import { ValidationService } from './validation';

const G_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const C_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

const validValuation = () => ({
  propertyId: 'prop-1',
  price: 100,
  confidence: 0.9,
  timestamp: new Date().toISOString(),
});

describe('ValidationService.validateValuationPayload', () => {
  it('accepts a valid payload', () => {
    expect(ValidationService.validateValuationPayload(validValuation())).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it('rejects missing propertyId', () => {
    const r = ValidationService.validateValuationPayload({ ...validValuation(), propertyId: '' });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Property ID is required');
  });

  it('rejects NaN price', () => {
    const r = ValidationService.validateValuationPayload({ ...validValuation(), price: NaN });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Valid price is required');
  });

  it('rejects non-numeric string price', () => {
    const r = ValidationService.validateValuationPayload({ ...validValuation(), price: 'abc' });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Valid price is required');
  });

  it('rejects NaN confidence', () => {
    const r = ValidationService.validateValuationPayload({ ...validValuation(), confidence: NaN });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Confidence must be between 0 and 1');
  });

  it('rejects an invalid timestamp with its own message', () => {
    const r = ValidationService.validateValuationPayload({
      ...validValuation(),
      timestamp: 'not-a-date',
    });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Valid timestamp is required');
  });

  it('rejects a stale timestamp', () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const r = ValidationService.validateValuationPayload({ ...validValuation(), timestamp: old });
    expect(r.errors).toContain('Valuation is too old');
  });
});

describe('ValidationService.validatePropertyInfo', () => {
  it('accepts valid info', () => {
    expect(
      ValidationService.validatePropertyInfo({ pricePerShare: 10, totalShares: 100 }).isValid,
    ).toBe(true);
  });

  it('rejects missing fields', () => {
    const r = ValidationService.validatePropertyInfo({});
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Valid price per share is required');
    expect(r.errors).toContain('Valid total shares is required');
  });

  it('rejects non-numeric pricePerShare', () => {
    const r = ValidationService.validatePropertyInfo({ pricePerShare: 'abc', totalShares: 100 });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Valid price per share is required');
  });
});

describe('ValidationService.validateTransaction', () => {
  it('accepts a valid transaction', () => {
    expect(
      ValidationService.validateTransaction({ amount: 5, sender: G_ADDRESS }).isValid,
    ).toBe(true);
  });

  it('rejects missing sender and amount', () => {
    const r = ValidationService.validateTransaction({});
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Valid amount is required');
    expect(r.errors).toContain('Valid sender address is required');
  });

  it('rejects non-numeric amount', () => {
    const r = ValidationService.validateTransaction({ amount: 'abc', sender: G_ADDRESS });
    expect(r.errors).toContain('Valid amount is required');
  });

  it('rejects Infinity amount', () => {
    const r = ValidationService.validateTransaction({ amount: 'Infinity', sender: G_ADDRESS });
    expect(r.errors).toContain('Valid amount is required');
  });
});

describe('ValidationService.validateLendingPool', () => {
  it('accepts a contract asset address', () => {
    expect(ValidationService.validateLendingPool({ assetAddress: C_ADDRESS }).isValid).toBe(true);
  });

  it('rejects a malformed asset address', () => {
    const r = ValidationService.validateLendingPool({ assetAddress: 'CNOTVALID' });
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Valid asset address is required');
  });

  it('rejects a missing asset address', () => {
    const r = ValidationService.validateLendingPool({});
    expect(r.errors).toContain('Valid asset address is required');
  });
});

describe('ValidationService.sanitizeString', () => {
  it('strips angle brackets and trims', () => {
    expect(ValidationService.sanitizeString('  <b>hi</b>  ')).toBe('bhi/b');
  });
});

describe('ValidationService.validateShareOwnership', () => {
  it('accepts a valid ownership record', () => {
    expect(
      ValidationService.validateShareOwnership({ owner: G_ADDRESS, shares: 10 }).isValid,
    ).toBe(true);
  });

  it('rejects a non-numeric share count', () => {
    const r = ValidationService.validateShareOwnership({ owner: G_ADDRESS, shares: 'abc' });
    expect(r.isValid).toBe(false);
  });

  it('rejects an invalid owner address', () => {
    const r = ValidationService.validateShareOwnership({ owner: 'GNOTVALID', shares: 10 });
    expect(r.isValid).toBe(false);
  });
});

describe('ValidationService.validateStellarAddress', () => {
  it('accepts a valid G address', () => {
    expect(ValidationService.validateStellarAddress(G_ADDRESS).isValid).toBe(true);
  });

  it('rejects a malformed address', () => {
    expect(ValidationService.validateStellarAddress('GNOTVALID').isValid).toBe(false);
  });

  it('rejects an empty address', () => {
    expect(ValidationService.validateStellarAddress('').isValid).toBe(false);
  });
});

describe('ValidationService.validateEmail', () => {
  it('accepts a valid email', () => {
    expect(ValidationService.validateEmail('user@example.com').isValid).toBe(true);
  });

  it('rejects an email without an @', () => {
    expect(ValidationService.validateEmail('userexample.com').isValid).toBe(false);
  });

  it('rejects an empty email', () => {
    expect(ValidationService.validateEmail('').isValid).toBe(false);
  });
});

describe('ValidationService.validateKYCDocument', () => {
  it('accepts a valid KYC document', () => {
    const doc = { type: 'passport', number: 'X1234567', expiresAt: new Date(Date.now() + 86400000).toISOString() };
    expect(ValidationService.validateKYCDocument(doc).isValid).toBe(true);
  });

  it('rejects an expired KYC document', () => {
    const doc = { type: 'passport', number: 'X1234567', expiresAt: new Date(Date.now() - 86400000).toISOString() };
    expect(ValidationService.validateKYCDocument(doc).isValid).toBe(false);
  });

  it('rejects a KYC document with missing fields', () => {
    expect(ValidationService.validateKYCDocument({}).isValid).toBe(false);
  });
});
