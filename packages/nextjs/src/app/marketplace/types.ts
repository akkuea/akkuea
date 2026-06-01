export type BuildingLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface Listing {
  id: string;
  coords: { x: number; y: number };
  level: BuildingLevel;
  incomeRate: number; // LAND per hour
  price: number; // LAND
  seller: string; // full address
  listedAt: Date;
  tileColor: string;
}

export type SortOption = 'price-asc' | 'price-desc' | 'newest';

export const LEVEL_LABELS: Record<BuildingLevel, string> = {
  0: 'Empty',
  1: 'Cottage',
  2: 'House',
  3: 'Villa',
  4: 'Tower',
  5: 'Skyscraper',
};

export const TILE_COLORS: Record<BuildingLevel, string> = {
  0: '#6b7280',
  1: '#84cc16',
  2: '#22c55e',
  3: '#06b6d4',
  4: '#8b5cf6',
  5: '#f59e0b',
};

export const MOCK_LISTINGS: Listing[] = [
  {
    id: '1',
    coords: { x: 12, y: 34 },
    level: 3,
    incomeRate: 4.5,
    price: 1200,
    seller: 'GBXLT...K7QP',
    listedAt: new Date(Date.now() - 1000 * 60 * 30),
    tileColor: TILE_COLORS[3],
  },
  {
    id: '2',
    coords: { x: 5, y: 8 },
    level: 1,
    incomeRate: 0.8,
    price: 150,
    seller: 'GCMN2...R3WA',
    listedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    tileColor: TILE_COLORS[1],
  },
  {
    id: '3',
    coords: { x: 99, y: 42 },
    level: 5,
    incomeRate: 18.0,
    price: 8500,
    seller: 'GDPQ7...X9NF',
    listedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    tileColor: TILE_COLORS[5],
  },
  {
    id: '4',
    coords: { x: 27, y: 61 },
    level: 2,
    incomeRate: 2.1,
    price: 420,
    seller: 'GBXLT...K7QP',
    listedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    tileColor: TILE_COLORS[2],
  },
  {
    id: '5',
    coords: { x: 3, y: 77 },
    level: 4,
    incomeRate: 9.2,
    price: 3300,
    seller: 'GCMN2...R3WA',
    listedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    tileColor: TILE_COLORS[4],
  },
  {
    id: '6',
    coords: { x: 55, y: 19 },
    level: 0,
    incomeRate: 0,
    price: 50,
    seller: 'GDPQ7...X9NF',
    listedAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
    tileColor: TILE_COLORS[0],
  },
];

export const MOCK_BALANCE = 2000; // player's LAND balance
