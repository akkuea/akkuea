import { describe, it, expect } from "bun:test";
import { propertyInfoSchema } from "../../src/schemas";

describe("propertyInfoSchema", () => {
  const validProperty = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Downtown Apartment",
    description:
      "A beautiful apartment in the city center with modern amenities",
    propertyType: "residential",
    location: {
      address: "123 Main St",
      city: "New York",
      country: "USA",
    },
    totalValue: "500000.00",
    totalShares: 1000,
    availableShares: 750,
    pricePerShare: "500.00",
    images: ["https://example.com/image1.jpg"],
    documents: [],
    verified: true,
    listedAt: "2024-01-15T10:30:00Z",
    owner: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
  };

  it("should validate a correct property", () => {
    const result = propertyInfoSchema.safeParse(validProperty);
    expect(result.success).toBe(true);
  });

  it("should reject property with missing name", () => {
    const invalid = { ...validProperty, name: "" };
    const result = propertyInfoSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("name");
    }
  });

  it("should reject property with invalid Stellar address", () => {
    const invalid = { ...validProperty, owner: "invalid-address" };
    const result = propertyInfoSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject property with negative shares", () => {
    const invalid = { ...validProperty, availableShares: -10 };
    const result = propertyInfoSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
