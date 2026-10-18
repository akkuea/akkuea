import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import type { PropertyInfo } from "@akkuea/shared";
import {
  filterAndSortProperties,
  getPropertyImage,
  MARKETPLACE_ALL_REGIONS,
  MARKETPLACE_ALL_TYPES,
  PROPERTY_IMAGE_PLACEHOLDER,
} from "@/components/marketplace/marketplace.utils";

const WEBAPP_PUBLIC_DIR = path.resolve(import.meta.dir, "../../../../public");

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

describe("getPropertyImage", () => {
  it("returns the first image when the property has images", () => {
    const property = buildProperty({
      images: [
        "https://images.unsplash.com/first.jpg",
        "https://images.unsplash.com/second.jpg",
      ],
    });
    expect(getPropertyImage(property)).toBe(
      "https://images.unsplash.com/first.jpg",
    );
  });

  it("returns the placeholder when the property has no images", () => {
    expect(getPropertyImage(buildProperty({ images: [] }))).toBe(
      PROPERTY_IMAGE_PLACEHOLDER,
    );
  });

  it("points the placeholder at a file shipped under public/", () => {
    expect(PROPERTY_IMAGE_PLACEHOLDER.startsWith("/")).toBe(true);
    expect(
      existsSync(path.join(WEBAPP_PUBLIC_DIR, PROPERTY_IMAGE_PLACEHOLDER)),
    ).toBe(true);
  });
});
