"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, ShoppingBag, LayoutDashboard, Wallet } from "lucide-react";

const NAV_LINKS = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

interface GameShellProps {
  children: React.ReactNode;
  /** Wallet address of the connected player, or null if disconnected */
  walletAddress?: string | null;
  /** LAND token balance */
  landBalance?: string;
}

export function GameShell({
  children,
  walletAddress = null,
  landBalance = "0",
}: GameShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-land-bg flex flex-col">
      {/* Top navigation */}
      <header className="h-14 bg-land-surface border-b border-land-border flex items-center px-4 gap-4 sticky top-0 z-50">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-land-fg hover:text-land-accent transition-colors shrink-0"
        >
          <span className="text-land-accent text-lg">◈</span>
          <span className="text-sm tracking-wide">AKKUEA LAND</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 ml-4">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? "bg-land-accent-dim text-land-accent"
                    : "text-land-fg-muted hover:text-land-fg hover:bg-land-surface-raised"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: LAND balance + wallet */}
        <div className="ml-auto flex items-center gap-3">
          {walletAddress && (
            <div className="flex items-center gap-1.5 bg-land-gold-dim border border-land-border rounded-lg px-3 py-1.5">
              <span className="text-land-gold text-xs font-mono font-bold">
                {landBalance}
              </span>
              <span className="text-land-fg-subtle text-xs">LAND</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-land-surface-raised border border-land-border rounded-lg px-3 py-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                walletAddress ? "bg-land-success" : "bg-land-fg-subtle"
              }`}
            />
            <Wallet size={14} className="text-land-fg-muted" />
            <span className="text-xs font-mono text-land-fg-muted">
              {walletAddress
                ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
                : "Not connected"}
            </span>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
