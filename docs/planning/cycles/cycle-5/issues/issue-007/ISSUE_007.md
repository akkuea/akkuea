# Bootstrap akkuea-land Next.js App and Design System

## Context

Akkuea Land is a standalone product that lives completely apart from the main Akkuea investment platform. It has its own identity, its own users (game players, not necessarily investors), and its own technical stack. Building it as a separate Next.js application at `apps/akkuea-land/` reflects this separation clearly and avoids coupling two products that should evolve independently.

Before any game UI can be built, the application needs to exist: its package.json, its routing structure, its design system, and its shared layout shell.

## What Needs to Be Done

Create `apps/akkuea-land/` as a new Next.js 15 application using the App Router. Initialize it with its own `package.json` (separate from `apps/webapp`), its own `tailwind.config.ts`, and its own `next.config.ts`. Configure TypeScript with `paths` aliasing so `@/` resolves to `src/` and `@akkuea/shared` resolves to the shared package.

Define the game's design system in `tailwind.config.ts`: a dark-first color palette distinct from the main platform, a custom font stack, and utility tokens for the game's tile grid. The game brand should feel like a product in its own right, not a section of akkuea.com.

Create the top-level route structure: `/` (game landing), `/map` (city map), `/marketplace` (listings), `/dashboard` (player portfolio), and `/(auth)/login` (Pollar login). Each route gets a `page.tsx` placeholder and a `loading.tsx` skeleton so the shell is complete from day one.

Create `src/components/layout/GameShell.tsx`, the persistent application frame: top navigation with the game logo, wallet status indicator, LAND balance display, and nav links. This shell wraps every authenticated route.

## Acceptance Criteria

- `apps/akkuea-land/` exists with its own `package.json`, separate from any other app.
- `bun run dev` inside `apps/akkuea-land/` starts the app on its own port.
- All five routes render without errors.
- The design system tokens (colors, typography) are defined and distinct from the main platform.
- All CI workflows pass on the submitted pull request.

## Quality Standard

This scaffold is the foundation every other GAME issue builds on. Route structure, aliasing, and design tokens must be correct from the start: fixing them later costs time across all downstream issues. Do not leave placeholder comments or half-wired configs. Every file created must be functional.
