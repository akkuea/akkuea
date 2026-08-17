import React from "react";
import { ArrowRight } from "lucide-react";

/**
 * "This is a simulation, see the real pilot" call-to-action.
 *
 * Implements the acquisition-funnel recommendation in
 * `docs/strategy/recommendations.md` (section 2b): Akkuea Land is the pilot's
 * educational companion, so a player who understands the buy, earn, claim loop
 * should be given a route to the real thing rather than a dead end.
 *
 * Two variants so the same copy and link are never re-implemented per surface:
 * - `banner`: bordered card for the end of the onboarding flow.
 * - `compact`: single muted line for persistent chrome (dashboard footer).
 */

const PILOT_URL = "https://akkuea.com";

export function PilotCta({
  variant = "banner",
}: {
  variant?: "banner" | "compact";
}) {
  if (variant === "compact") {
    return (
      <p className="text-xs text-land-fg-muted">
        This is a simulation.{" "}
        <a
          href={PILOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-land-accent underline underline-offset-2 hover:text-land-accent/80 transition-colors inline-flex items-center gap-1"
        >
          See the Akkuea Pilot
          <ArrowRight size={11} aria-hidden="true" />
        </a>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-land-accent/30 bg-land-accent-dim px-4 py-3 text-center space-y-1">
      <p className="text-xs text-land-fg-muted leading-relaxed">
        This is a simulation. Ready to see real yield from real property?
      </p>
      <a
        href={PILOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-land-accent underline underline-offset-2 hover:text-land-accent/80 transition-colors inline-flex items-center gap-1"
      >
        See the Akkuea Pilot
        <ArrowRight size={12} aria-hidden="true" />
      </a>
    </div>
  );
}
