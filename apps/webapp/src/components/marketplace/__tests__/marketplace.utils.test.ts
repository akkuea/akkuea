import { describe, expect, it } from "bun:test";
import type { PropertyInfo } from "@real-estate-defi/shared";
import {
  filterAndSortProperties,
  MARKETPLACE_ALL_REGIONS,
  MARKETPLACE_ALL_TYPES,
} from "@/components/marketplace/marketplace.utils";

function buildProperty(overrides: Partial<PropertyInfo>): PropertyInfo {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Test Property",
    description: "A property used for unit tests.",
    propertyType: "residential",
    location: {
      address: "1 Test Street",
      city: "Testville",
      country: "Nigeria",
    },
    totalValue: "1000000",
    totalShares: 1000,
    availableShares: 500,
    pricePerShare: "100",
    images: ["https://example.com/image.jpg"],
    documents: [],
    verified: true,
    listedAt: "2024-01-01T00:00:00.000Z",
    owner: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
    ...overrides,
  };
}

const baseFilters = {
  searchQuery: "",
  selectedRegion: MARKETPLACE_ALL_REGIONS,
  selectedType: MARKETPLACE_ALL_TYPES,
};

describe("filterAndSortProperties", () => {
  const cheap = buildProperty({
    id: "1",
    name: "Cheap",
    pricePerShare: "10",
    expectedYield: 5,
  });
  const expensive = buildProperty({
    id: "2",
    name: "Expensive",
    pricePerShare: "500",
    expectedYield: 12,
  });
  const noYield = buildProperty({
    id: "3",
    name: "NoYield",
    pricePerShare: "250",
    expectedYield: undefined,
  });

  const properties = [cheap, expensive, noYield];

  it("sorts by price ascending", () => {
    const result = filterAndSortProperties(properties, {
      ...baseFilters,
      sortBy: "Price: Low to High",
    });
    expect(result.map((p) => p.id)).toEqual(["1", "3", "2"]);
  });

  it("sorts by price descending", () => {
    const result = filterAndSortProperties(properties, {
      ...baseFilters,
      sortBy: "Price: High to Low",
    });
    expect(result.map((p) => p.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by yield ascending, treating missing yield as 0", () => {
    const result = filterAndSortProperties(properties, {
      ...baseFilters,
      sortBy: "Yield: Low to High",
    });
    expect(result.map((p) => p.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts by yield descending, treating missing yield as 0", () => {
    const result = filterAndSortProperties(properties, {
      ...baseFilters,
      sortBy: "Yield: High to Low",
    });
    expect(result.map((p) => p.id)).toEqual(["2", "1", "3"]);
  });

  it("returns an empty list when no property matches the search query", () => {
    const result = filterAndSortProperties(properties, {
      ...baseFilters,
      searchQuery: "no-such-property-xyz",
      sortBy: "Recently Added",
    });
    expect(result).toEqual([]);
  });
});
