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

const STORYBOOK_BASE =
  process.env.PLAYWRIGHT_STORYBOOK_URL ?? "http://localhost:6006";

type Theme = "dark" | "light";

const THEMES: Array<{ name: Theme; background: string }> = [
  { name: "dark", background: "#000000" },
  { name: "light", background: "#ffffff" },
];

/**
 * Storybook story IDs for all pilot components matching index.json.
 */
const PILOT_STORIES: Array<{ id: string; description: string }> = [
  // CycleStatusBadge
  {
    id: "pilot-cyclestatusbadge--on-time",
    description: "CycleStatusBadge/OnTime",
  },
  { id: "pilot-cyclestatusbadge--late", description: "CycleStatusBadge/Late" },
  {
    id: "pilot-cyclestatusbadge--disputed",
    description: "CycleStatusBadge/Disputed",
  },
  {
    id: "pilot-cyclestatusbadge--not-received",
    description: "CycleStatusBadge/NotReceived",
  },
  {
    id: "pilot-cyclestatusbadge--pending",
    description: "CycleStatusBadge/Pending",
  },
  // CycleStatusTimeline
  {
    id: "pilot-cyclestatustimeline--populated",
    description: "CycleStatusTimeline/Populated",
  },
  {
    id: "pilot-cyclestatustimeline--loading",
    description: "CycleStatusTimeline/Loading",
  },
  {
    id: "pilot-cyclestatustimeline--error",
    description: "CycleStatusTimeline/Error",
  },
  {
    id: "pilot-cyclestatustimeline--empty",
    description: "CycleStatusTimeline/Empty",
  },
  {
    id: "pilot-cyclestatustimeline--stale-after-failed-poll",
    description: "CycleStatusTimeline/StaleAfterFailedPoll",
  },
  {
    id: "pilot-cyclestatustimeline--escalated",
    description: "CycleStatusTimeline/Escalated",
  },
  // EvidenceReviewQueue
  {
    id: "pilot-evidencereviewqueue--populated",
    description: "EvidenceReviewQueue/Populated",
  },
  {
    id: "pilot-evidencereviewqueue--disconnected-wallet",
    description: "EvidenceReviewQueue/DisconnectedWallet",
  },
  {
    id: "pilot-evidencereviewqueue--loading",
    description: "EvidenceReviewQueue/Loading",
  },
  {
    id: "pilot-evidencereviewqueue--error",
    description: "EvidenceReviewQueue/Error",
  },
  {
    id: "pilot-evidencereviewqueue--empty",
    description: "EvidenceReviewQueue/Empty",
  },
  {
    id: "pilot-evidencereviewqueue--contract-paused",
    description: "EvidenceReviewQueue/ContractPaused",
  },
  // EvidenceSubmissionForm
  {
    id: "pilot-evidencesubmissionform--ready",
    description: "EvidenceSubmissionForm/Ready",
  },
  {
    id: "pilot-evidencesubmissionform--disconnected-wallet",
    description: "EvidenceSubmissionForm/DisconnectedWallet",
  },
  {
    id: "pilot-evidencesubmissionform--awaiting-review",
    description: "EvidenceSubmissionForm/AwaitingReview",
  },
  {
    id: "pilot-evidencesubmissionform--rejected",
    description: "EvidenceSubmissionForm/Rejected",
  },
  {
    id: "pilot-evidencesubmissionform--approved",
    description: "EvidenceSubmissionForm/Approved",
  },
  {
    id: "pilot-evidencesubmissionform--contract-paused",
    description: "EvidenceSubmissionForm/ContractPaused",
  },
  // InvestorHoldingsCard
  {
    id: "pilot-investorholdingscard--populated",
    description: "InvestorHoldingsCard/Populated",
  },
  {
    id: "pilot-investorholdingscard--loading",
    description: "InvestorHoldingsCard/Loading",
  },
  {
    id: "pilot-investorholdingscard--error",
    description: "InvestorHoldingsCard/Error",
  },
  {
    id: "pilot-investorholdingscard--empty",
    description: "InvestorHoldingsCard/Empty",
  },
  {
    id: "pilot-investorholdingscard--disconnected-wallet",
    description: "InvestorHoldingsCard/DisconnectedWallet",
  },
  {
    id: "pilot-investorholdingscard--not-whitelisted",
    description: "InvestorHoldingsCard/NotWhitelisted",
  },
  // PropertyEvidencePanel
  {
    id: "pilot-propertyevidencepanel--no-capture-yet",
    description: "PropertyEvidencePanel/NoCaptureYet",
  },
  {
    id: "pilot-propertyevidencepanel--with-capture",
    description: "PropertyEvidencePanel/WithCapture",
  },
  // WhitelistOnboardingForm
  {
    id: "pilot-whitelistonboardingform--no-application",
    description: "WhitelistOnboardingForm/NoApplication",
  },
  {
    id: "pilot-whitelistonboardingform--status-loading",
    description: "WhitelistOnboardingForm/StatusLoading",
  },
  {
    id: "pilot-whitelistonboardingform--pending-review",
    description: "WhitelistOnboardingForm/PendingReview",
  },
  {
    id: "pilot-whitelistonboardingform--approved",
    description: "WhitelistOnboardingForm/Approved",
  },
  {
    id: "pilot-whitelistonboardingform--rejected",
    description: "WhitelistOnboardingForm/Rejected",
  },
  {
    id: "pilot-whitelistonboardingform--form-step-1-personal-details",
    description: "WhitelistOnboardingForm/FormStep1PersonalDetails",
  },
  {
    id: "pilot-whitelistonboardingform--form-step-3-review",
    description: "WhitelistOnboardingForm/FormStep3Review",
  },
  // WhitelistReviewQueue
  {
    id: "pilot-whitelistreviewqueue--with-requests",
    description: "WhitelistReviewQueue/WithRequests",
  },
  {
    id: "pilot-whitelistreviewqueue--empty-queue",
    description: "WhitelistReviewQueue/EmptyQueue",
  },
  {
    id: "pilot-whitelistreviewqueue--loading-state",
    description: "WhitelistReviewQueue/LoadingState",
  },
  {
    id: "pilot-whitelistreviewqueue--error-state",
    description: "WhitelistReviewQueue/ErrorState",
  },
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
      colorScheme: theme === "dark" ? "dark" : "light",
    });

    for (const story of PILOT_STORIES) {
      test(`${story.description} matches baseline`, async ({ page }) => {
        const url = storyIframeUrl(story.id, background);
        await page.goto(url, { waitUntil: "networkidle" });

        // Wait for Storybook story root to appear.
        await page.waitForSelector("#storybook-root", {
          state: "visible",
          timeout: 15_000,
        });

        // Pause for entrance animations.
        await page.waitForTimeout(300);

        const storyRoot = page.locator("#storybook-root");

        await expect(storyRoot).toHaveScreenshot(`${story.id}-${theme}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: "disabled",
        });
      });
    }
  });
}
