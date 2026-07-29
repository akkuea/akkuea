import { describe, expect, it } from 'bun:test';
import { marketplaceQuerySchema } from '../dto/marketplace.dto';

describe('marketplaceQuerySchema – Zod validation', () => {
  it('applies default values for page and limit', () => {
    const result = marketplaceQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortOrder).toBe('desc');
    }
  });

  it('accepts valid page and limit', () => {
    const result = marketplaceQuerySchema.safeParse({ page: '3', limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(10);
    }
  });

  it('rejects negative page', () => {
    const result = marketplaceQuerySchema.safeParse({ page: '-1' });
    expect(result.success).toBe(false);
  });

  it('rejects zero page', () => {
    const result = marketplaceQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects limit > 100', () => {
    const result = marketplaceQuerySchema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });

  it('accepts valid propertyType filter', () => {
    const result = marketplaceQuerySchema.safeParse({ propertyType: 'residential' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.propertyType).toBe('residential');
    }
  });

  it('rejects invalid propertyType', () => {
    const result = marketplaceQuerySchema.safeParse({ propertyType: 'villa' });
    expect(result.success).toBe(false);
  });

  it('accepts valid price range filters', () => {
    const result = marketplaceQuerySchema.safeParse({
      minPrice: '500',
      maxPrice: '2000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minPrice).toBe(500);
      expect(result.data.maxPrice).toBe(2000);
    }
  });

  it('rejects negative minPrice', () => {
    const result = marketplaceQuerySchema.safeParse({ minPrice: '-100' });
    expect(result.success).toBe(false);
  });

  it('accepts valid sortBy and sortOrder', () => {
    const result = marketplaceQuerySchema.safeParse({
      sortBy: 'totalValue',
      sortOrder: 'asc',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortBy).toBe('totalValue');
      expect(result.data.sortOrder).toBe('asc');
    }
  });

  it('rejects invalid sortOrder', () => {
    const result = marketplaceQuerySchema.safeParse({ sortOrder: 'random' });
    expect(result.success).toBe(false);
  });

  it('accepts valid country filter', () => {
    const result = marketplaceQuerySchema.safeParse({ country: 'US' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe('US');
    }
  });

  it('accepts all filters combined', () => {
    const result = marketplaceQuerySchema.safeParse({
      page: '2',
      limit: '5',
      sortBy: 'pricePerShare',
      sortOrder: 'asc',
      propertyType: 'commercial',
      minPrice: '100',
      maxPrice: '5000',
      city: 'Miami',
      country: 'US',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(5);
      expect(result.data.propertyType).toBe('commercial');
      expect(result.data.minPrice).toBe(100);
      expect(result.data.maxPrice).toBe(5000);
      expect(result.data.country).toBe('US');
    }
  });
});
