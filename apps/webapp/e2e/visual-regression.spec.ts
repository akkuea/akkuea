import { test, expect } from "@playwright/test";

/**
 * Visual regression tests against the static Storybook build.
 *
 * This suite runs Playwright `toHaveScreenshot` against every pilot Storybook
 * story in both light and dark themes. Baseline PNG files are committed in
 * `e2e/snapshots/` and checked in CI so any unintended visual drift fails the
 * build immediately.
 *
 * To update baselines after an intentional UI change, run:
 *   bunx playwright test e2e/visual-regression.spec.ts --update-snapshots
 * See `e2e/README.md` for the full update procedure.
 */

const STORYBOOK_BASE = process.env.PLAYWRIGHT_STORYBOOK_URL ?? "http://localhost:6006";

type Theme = "dark" | "light";

const THEMES: Array<{ name: Theme; background: string }> = [
  { name: "dark", background: "#000000" },
  { name: "light", background: "#ffffff" },
];

/**
 * Storybook story IDs for all pilot components.
 *
 * The ID format is `<story-path>--<story-name>` (all lowercase with dashes).
 * These match the `title` / export names defined in each `.stories.tsx` file.
 */
const PILOT_STORIES: Array<{ id: string; description: string }> = [
  // CycleStatusBadge
  { id: "pilot-cyclestatusbadge--on-time", description: "CycleStatusBadge/OnTime" },
  { id: "pilot-cyclestatusbadge--late", description: "CycleStatusBadge/Late" },
  { id: "pilot-cyclestatusbadge--disputed", description: "CycleStatusBadge/Disputed" },
  { id: "pilot-cyclestatusbadge--not-received", description: "CycleStatusBadge/NotReceived" },
  { id: "pilot-cyclestatusbadge--pending", description: "CycleStatusBadge/Pending" },
  // CycleStatusTimeline
  { id: "pilot-cyclestatustimeline--default", description: "CycleStatusTimeline/Default" },
  { id: "pilot-cyclestatustimeline--loading", description: "CycleStatusTimeline/Loading" },
  { id: "pilot-cyclestatustimeline--error", description: "CycleStatusTimeline/Error" },
  { id: "pilot-cyclestatustimeline--escalated", description: "CycleStatusTimeline/Escalated" },
  // EvidenceReviewQueue
  { id: "pilot-evidencereviewqueue--default", description: "EvidenceReviewQueue/Default" },
  { id: "pilot-evidencereviewqueue--empty", description: "EvidenceReviewQueue/Empty" },
  { id: "pilot-evidencereviewqueue--loading", description: "EvidenceReviewQueue/Loading" },
  // EvidenceSubmissionForm
  { id: "pilot-evidencesubmissionform--connected", description: "EvidenceSubmissionForm/Connected" },
  { id: "pilot-evidencesubmissionform--disconnected", description: "EvidenceSubmissionForm/Disconnected" },
  { id: "pilot-evidencesubmissionform--rejected", description: "EvidenceSubmissionForm/Rejected" },
  { id: "pilot-evidencesubmissionform--paused", description: "EvidenceSubmissionForm/Paused" },
  // InvestorHoldingsCard
  { id: "pilot-investorholdingscard--default", description: "InvestorHoldingsCard/Default" },
  { id: "pilot-investorholdingscard--not-whitelisted", description: "InvestorHoldingsCard/NotWhitelisted" },
  { id: "pilot-investorholdingscard--no-holdings", description: "InvestorHoldingsCard/NoHoldings" },
  { id: "pilot-investorholdingscard--loading", description: "InvestorHoldingsCard/Loading" },
  // PropertyEvidencePanel
  { id: "pilot-propertyevidencepanel--no-splat", description: "PropertyEvidencePanel/NoSplat" },
  // WhitelistOnboardingForm
  { id: "pilot-whitelistonboardingform--default", description: "WhitelistOnboardingForm/Default" },
  { id: "pilot-whitelistonboardingform--pending", description: "WhitelistOnboardingForm/Pending" },
  { id: "pilot-whitelistonboardingform--approved", description: "WhitelistOnboardingForm/Approved" },
  { id: "pilot-whitelistonboardingform--rejected", description: "WhitelistOnboardingForm/Rejected" },
  // WhitelistReviewQueue
  { id: "pilot-whitelistreviewqueue--default", description: "WhitelistReviewQueue/Default" },
  { id: "pilot-whitelistreviewqueue--empty", description: "WhitelistReviewQueue/Empty" },
  { id: "pilot-whitelistreviewqueue--loading", description: "WhitelistReviewQueue/Loading" },
];

function storyIframeUrl(storyId: string, background: string): string {
  const bgEncoded = encodeURIComponent(background);
  return `${STORYBOOK_BASE}/iframe.html?id=${storyId}&viewMode=story&globals=backgrounds.value:${bgEncoded}`;
}

// Each story renders inside Storybook's iframe. We load the iframe URL directly
// so the screenshot is fully contained to the component, not the Storybook UI.
for (const { name: theme, background } of THEMES) {
  test.describe(`Visual regression - ${theme} theme`, () => {
    test.use({
      viewport: { width: 1280, height: 720 },
      // Pin colorScheme to match theme context so system dark-mode detection
      // does not introduce drift between CI machines.
      colorScheme: theme === "dark" ? "dark" : "light",
    });

    for (const story of PILOT_STORIES) {
      test(`${story.description} matches baseline`, async ({ page }) => {
        const url = storyIframeUrl(story.id, background);
        await page.goto(url, { waitUntil: "networkidle" });

        // Wait for Storybook story root to appear, indicating the story rendered.
        await page.waitForSelector("#storybook-root", { state: "visible", timeout: 15_000 });

        // Small settle pause for any entrance animations to finish.
        await page.waitForTimeout(300);

        // Clip to the story root to avoid capturing Storybook chrome.
        const storyRoot = page.locator("#storybook-root");

        await expect(storyRoot).toHaveScreenshot(
          `${story.id}-${theme}.png`,
          {
            // Allow up to 1% pixel difference (font rendering can vary slightly
            // between CI and local due to subpixel hinting).
            maxDiffPixelRatio: 0.01,
            animations: "disabled",
          },
        );
      });
    }
  });
}
