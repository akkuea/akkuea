import { vi } from 'vitest';

// Mock next/navigation
export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  route: '/',
}));

export const usePathname = vi.fn(() => '/');

export const useSearchParams = vi.fn(() => ({
  get: vi.fn(),
  getAll: vi.fn(),
  has: vi.fn(),
  keys: vi.fn(),
  values: vi.fn(),
  entries: vi.fn(),
  forEach: vi.fn(),
  toString: vi.fn(),
}));

export const useParams = vi.fn(() => ({}));

export const redirect = vi.fn();

export const notFound = vi.fn();

export const permanentRedirect = vi.fn();
