import type { PropertyInfo } from "@real-estate-defi/shared";

export const MARKETPLACE_ALL_REGIONS = "All Regions";
export const MARKETPLACE_ALL_TYPES = "All Types";

export const sortOptions = [
  "Recently Added",
  "Lowest Price",
  "Most Funded",
  "Highest Value",
] as const;

export type MarketplaceSortOption = (typeof sortOptions)[number];

const REGION_BY_COUNTRY: Record<string, string> = {
  Nigeria: "Africa",
  Kenya: "Africa",
  Ghana: "Africa",
  "South Africa": "Africa",
  Mexico: "Latin America",
  Colombia: "Latin America",
  Brazil: "Latin America",
  Argentina: "Latin America",
  Peru: "Latin America",
  Chile: "Latin America",
  Panama: "Latin America",
  "Costa Rica": "Latin America",
};

export function getPropertyRegion(country: string): string {
  return REGION_BY_COUNTRY[country] ?? "Global";
}

export function getPropertyTypeLabel(
  propertyType: PropertyInfo["propertyType"],
): string {
  return propertyType.charAt(0).toUpperCase() + propertyType.slice(1);
}

export function getFundingProgress(property: PropertyInfo): number {
  if (property.totalShares <= 0) {
    return 0;
  }

  const soldShares = property.totalShares - property.availableShares;
  return Math.max(
    0,
    Math.min(100, Math.round((soldShares / property.totalShares) * 100)),
  );
}

export function getRegions(properties: PropertyInfo[]): string[] {
  const regions = new Set<string>();

  for (const property of properties) {
    regions.add(getPropertyRegion(property.location.country));
  }

  return [MARKETPLACE_ALL_REGIONS, ...Array.from(regions).sort()];
}

export function getPropertyTypes(properties: PropertyInfo[]): string[] {
  const types = new Set<string>();

  for (const property of properties) {
    types.add(getPropertyTypeLabel(property.propertyType));
  }

  return [MARKETPLACE_ALL_TYPES, ...Array.from(types).sort()];
}

interface FilterOptions {
  searchQuery: string;
  selectedRegion: string;
  selectedType: string;
  sortBy: MarketplaceSortOption;
}

export function filterAndSortProperties(
  properties: PropertyInfo[],
  { searchQuery, selectedRegion, selectedType, sortBy }: FilterOptions,
): PropertyInfo[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return [...properties]
    .filter((property) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        property.name.toLowerCase().includes(normalizedSearch) ||
        property.location.city.toLowerCase().includes(normalizedSearch) ||
        property.location.country.toLowerCase().includes(normalizedSearch);

      const matchesRegion =
        selectedRegion === MARKETPLACE_ALL_REGIONS ||
        getPropertyRegion(property.location.country) === selectedRegion;

      const matchesType =
        selectedType === MARKETPLACE_ALL_TYPES ||
        getPropertyTypeLabel(property.propertyType) === selectedType;

      return matchesSearch && matchesRegion && matchesType;
    })
    .sort((left, right) => {
      switch (sortBy) {
        case "Recently Added":
          return Date.parse(right.listedAt) - Date.parse(left.listedAt);
        case "Lowest Price":
          return (
            parseFloat(left.pricePerShare) - parseFloat(right.pricePerShare)
          );
        case "Most Funded":
          return getFundingProgress(right) - getFundingProgress(left);
        case "Highest Value":
          return parseFloat(right.totalValue) - parseFloat(left.totalValue);
        default:
          return 0;
      }
    });
}

export function getPropertyImage(property: PropertyInfo): string {
  return property.images[0] ?? "/images/property-placeholder.png";
}
