# C5-007: Bootstrap akkuea-land Next.js App and Design System

## Issue Metadata

| Attribute       | Value            |
| --------------- | ---------------- |
| Issue ID        | C5-007           |
| Area            | GAME             |
| Difficulty      | Medium           |
| Labels          | frontend, medium |
| Dependencies    | None             |
| Estimated Lines | 150-220          |

## Initialization

From the `apps/` directory:

```bash
bunx create-next-app@latest akkuea-land \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint
cd akkuea-land
bun add @akkuea/shared
```

Run on a separate port to avoid conflicts with `apps/webapp`:

```json
// package.json scripts
"dev": "next dev --port 3001",
"build": "next build",
"start": "next start --port 3001",
"type-check": "tsc --noEmit"
```

## tsconfig.json paths

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@akkuea/shared": ["../shared/src/index.ts"]
    }
  }
}
```

## Design System (tailwind.config.ts)

The game uses a dark-first palette distinct from the main platform:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Game brand: deep navy base, gold accents
        land: {
          50: "#f0f4ff",
          100: "#dde6ff",
          200: "#c3d0ff",
          300: "#9fb0ff",
          400: "#7b8aff",
          500: "#5c63f5",
          600: "#4a47e8",
          700: "#3c36cf",
          800: "#322da8",
          900: "#2d2a85",
          950: "#1c1a54",
        },
        gold: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        surface: {
          900: "#0d0f1a",
          800: "#141728",
          700: "#1e2237",
          600: "#272b42",
          border: "#2e3350",
        },
      },
      fontFamily: {
        sans: ["Inter var", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "tile-pulse": "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-right": "slideRight 0.25s ease-out",
        "fade-in": "fadeIn 0.15s ease-out",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
};

export default config;
```

## Route Structure

```
src/app/
  layout.tsx                    ← root layout, PollarProvider (added in C5-008)
  page.tsx                      ← game landing /
  loading.tsx                   ← global loading skeleton
  (auth)/
    login/
      page.tsx                  ← Pollar login (C5-008)
  map/
    page.tsx                    ← city map (C5-009)
    loading.tsx
  marketplace/
    page.tsx                    ← listings (C5-011)
    loading.tsx
  dashboard/
    page.tsx                    ← player portfolio (C5-012)
    loading.tsx
  onboarding/
    page.tsx                    ← first-time flow (C5-016)
  api/
    game/
      events/
        route.ts                ← SSE stream (C5-014)
        history/
          route.ts              ← paginated history (C5-014)
```

## GameShell Component

```tsx
// src/components/layout/GameShell.tsx
import Link from "next/link";
import { WalletStatus } from "@/components/wallet/WalletStatus";

const NAV_LINKS = [
  { href: "/map", label: "City Map" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/dashboard", label: "Dashboard" },
];

export function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-800/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-base font-bold tracking-tight text-land-400"
            >
              Akkuea Land
            </Link>
            <nav className="hidden items-center gap-5 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-surface-600 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <WalletStatus />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
```

## Loading Skeleton Component

Create `src/components/ui/Skeleton.tsx` as the base loading primitive:

```tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-surface-700 ${className ?? ""}`}
    />
  );
}
```

Use this in all `loading.tsx` files rather than a spinner.

## Game Landing Page

```tsx
// src/app/page.tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
        Own a piece of the city.
      </h1>
      <p className="mb-10 max-w-md text-base text-surface-600">
        Buy virtual properties on Stellar, earn rental income as time passes,
        and trade with other players in a live marketplace.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="rounded-xl bg-land-500 px-8 py-3 text-sm font-semibold text-white transition hover:bg-land-400"
        >
          Start Playing
        </Link>
        <Link
          href="/map"
          className="rounded-xl border border-surface-border px-8 py-3 text-sm font-semibold text-white transition hover:bg-surface-700"
        >
          View City Map
        </Link>
      </div>
    </div>
  );
}
```

## .env.example

```env
# Pollar
NEXT_PUBLIC_POLLAR_API_KEY=pub_testnet_...

# Stellar
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Game contracts (filled after C5-015)
NEXT_PUBLIC_GAME_NFT_CONTRACT_ID=
NEXT_PUBLIC_GAME_TOKEN_CONTRACT_ID=
NEXT_PUBLIC_GAME_MARKETPLACE_CONTRACT_ID=
NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID=

# Development
NEXT_PUBLIC_USE_MOCK=true
```

## Definition of Done

- `apps/akkuea-land/` is initialized and starts on port 3001 with `bun run dev`.
- All routes exist with placeholder pages and loading skeletons.
- Design system tokens are defined in `tailwind.config.ts`.
- `GameShell` and `Skeleton` components are functional.
- `.env.example` is committed.
- `bun run type-check` passes.
- All CI workflows pass on the pull request.
