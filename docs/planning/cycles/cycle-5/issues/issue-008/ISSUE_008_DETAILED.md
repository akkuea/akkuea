# C5-008: Integrate Pollar Authentication and Wallet Provider

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C5-008         |
| Area            | GAME           |
| Difficulty      | High           |
| Labels          | frontend, high |
| Dependencies    | C5-007         |
| Estimated Lines | 200-280        |

## Installation

```bash
cd apps/akkuea-land
bun add @pollar/react @pollar/core
```

## PollarProvider Setup

Wrap the root layout with `PollarProvider`. Keep the API key in the environment variable; never hardcode it.

```tsx
// src/app/layout.tsx
import { PollarProvider } from "@pollar/react";
import { GameShell } from "@/components/layout/GameShell";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PollarProvider apiKey={process.env.NEXT_PUBLIC_POLLAR_API_KEY!}>
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
```

## useGameWallet Hook

All game components go through this hook. No other file imports from `@pollar/react` directly.

```typescript
// src/hooks/useGameWallet.ts
"use client";

import { usePollar } from "@pollar/react";

export interface GameWallet {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  login: (
    provider: "google" | "github" | "email" | "freighter",
    email?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  signAndSubmitTx: (unsignedXdr: string) => Promise<string>;
}

export function useGameWallet(): GameWallet {
  const { wallet, login, logout, signAndSubmitTx, loading } = usePollar();

  return {
    address: wallet?.address ?? null,
    isConnected: !!wallet?.address,
    isLoading: loading,
    login: async (provider, email) => {
      if (provider === "email") {
        await login({ provider: "email", email: email!, type: "otp" });
      } else if (provider === "freighter") {
        await login({ provider: "freighter" });
      } else {
        await login({ provider });
      }
    },
    logout,
    signAndSubmitTx,
  };
}
```

## Login Page

```tsx
// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameWallet } from "@/hooks/useGameWallet";

export default function LoginPage() {
  const { login, isLoading } = useGameWallet();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"options" | "email-otp">("options");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("from") ?? "/onboarding";

  const handleLogin = async (
    provider: "google" | "github" | "email" | "freighter",
  ) => {
    setError(null);
    try {
      await login(provider, provider === "email" ? email : undefined);
      router.push(returnTo);
    } catch (err) {
      setError(getReadableError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Join Akkuea Land</h1>
          <p className="mt-2 text-sm text-surface-600">
            Sign in to start playing. Your Stellar wallet is created
            automatically.
          </p>
        </div>

        {step === "options" && (
          <div className="space-y-3">
            <SocialButton
              icon="google"
              label="Continue with Google"
              onClick={() => handleLogin("google")}
              disabled={isLoading}
            />
            <SocialButton
              icon="github"
              label="Continue with GitHub"
              onClick={() => handleLogin("github")}
              disabled={isLoading}
            />
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-border" />
              </div>
              <div className="relative flex justify-center text-xs text-surface-600">
                <span className="bg-surface-900 px-2">or</span>
              </div>
            </div>
            <button
              onClick={() => setStep("email-otp")}
              className="w-full rounded-xl border border-surface-border py-3 text-sm text-white transition hover:bg-surface-700"
            >
              Continue with Email
            </button>
            <button
              onClick={() => handleLogin("freighter")}
              disabled={isLoading}
              className="w-full rounded-xl border border-surface-border py-3 text-xs text-surface-600 transition hover:bg-surface-700"
            >
              I already have a Stellar wallet (Freighter)
            </button>
          </div>
        )}

        {step === "email-otp" && (
          <div className="space-y-3">
            <button
              onClick={() => setStep("options")}
              className="mb-2 text-xs text-surface-600 hover:text-white"
            >
              Back
            </button>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface-800 px-4 py-3 text-sm text-white placeholder-surface-600 focus:border-land-500 focus:outline-none"
            />
            <button
              onClick={() => handleLogin("email")}
              disabled={!email || isLoading}
              className="w-full rounded-xl bg-land-500 py-3 text-sm font-semibold text-white transition hover:bg-land-400 disabled:opacity-50"
            >
              {isLoading ? "Sending code..." : "Send verification code"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}

function getReadableError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("WALLET_NOT_FOUND"))
      return "Wallet not found. Try again.";
    if (err.message.includes("STELLAR_UNAVAILABLE"))
      return "Stellar network is unavailable. Please try again shortly.";
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
```

## Route Protection Middleware

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/map", "/marketplace", "/dashboard", "/onboarding"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  // Pollar stores the session token in a cookie named 'pollar-session'
  const session = request.cookies.get("pollar-session");

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/map/:path*",
    "/marketplace/:path*",
    "/dashboard/:path*",
    "/onboarding/:path*",
  ],
};
```

Verify the exact cookie name Pollar uses by checking their documentation or the `usePollar()` session state. Adjust the cookie key accordingly.

## WalletStatus Widget

```tsx
// src/components/wallet/WalletStatus.tsx
"use client";

import { useGameWallet } from "@/hooks/useGameWallet";
import { useLandBalance } from "@/hooks/useLandBalance";
import { formatLand } from "@/lib/format";

export function WalletStatus() {
  const { address, isConnected, logout } = useGameWallet();
  const { balance } = useLandBalance(address);

  if (!isConnected) {
    return (
      <a
        href="/login"
        className="rounded-lg bg-land-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-land-400"
      >
        Connect
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {balance != null && (
        <span className="text-sm font-medium text-gold-400">
          {formatLand(balance)} LAND
        </span>
      )}
      <button
        onClick={logout}
        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-surface-600 hover:text-white"
        title={address ?? ""}
      >
        {address?.slice(0, 4)}...{address?.slice(-4)}
      </button>
    </div>
  );
}
```

## Definition of Done

- `PollarProvider` wraps the root layout.
- Login page renders three options: Google, GitHub, email OTP, and Freighter.
- Middleware redirects unauthenticated users to `/login` for protected routes.
- `useGameWallet` exposes `address`, `isConnected`, `login`, `logout`, `signAndSubmitTx`.
- `WalletStatus` widget shows balance and address in the nav shell.
- Error states on the login page show readable messages.
- All CI workflows pass on the pull request.
