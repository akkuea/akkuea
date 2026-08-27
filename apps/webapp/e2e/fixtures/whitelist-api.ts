import type { Page } from "@playwright/test";

/**
 * Mocked API layer for the pilot whitelist onboarding/review flow.
 *
 * `WhitelistOnboardingForm` calls the external API directly
 * (`NEXT_PUBLIC_API_URL/pilot/whitelist/...`), while `WhitelistReviewQueue`
 * goes through the Next.js admin operations proxy
 * (`/api/admin/operations/pilot/whitelist/...`). Both paths are matched by
 * pathname suffix here so one set of helpers covers both components
 * regardless of which host served the request.
 *
 * These mocks fully replace the backend: nothing in this suite talks to a
 * real API server or a testnet transaction. To point these specs at a real
 * environment instead, remove the relevant `page.route()` call in a given
 * test and provide a live, seeded backend at the configured API URL.
 */

export type WhitelistStatus = "none" | "pending" | "approved" | "rejected";

export interface WhitelistRequestFixture {
  id: string;
  walletAddress: string;
  fullName: string;
  idType: string;
  idReference: string;
  status: string;
  createdAt: string;
}

export function buildWhitelistRequest(
  overrides: Partial<WhitelistRequestFixture> = {},
): WhitelistRequestFixture {
  return {
    id: "req-e2e-001",
    walletAddress: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
    fullName: "Maria Santos",
    idType: "passport",
    idReference: "P-84721934",
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Mocks `GET /pilot/whitelist/status/:walletAddress`, used by the onboarding form. */
export async function mockWhitelistStatus(
  page: Page,
  options: {
    status?: WhitelistStatus;
    rejectionReason?: string;
    delayMs?: number;
  } = {},
): Promise<void> {
  const { status = "none", rejectionReason, delayMs = 0 } = options;

  await page.route(
    (url) => /\/pilot\/whitelist\/status\//.test(url.pathname),
    async (route) => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, status, rejectionReason }),
      });
    },
  );
}

/** Mocks `POST /pilot/whitelist/request`, used to submit the onboarding form. */
export async function mockWhitelistSubmit(
  page: Page,
  options: { fail?: boolean; message?: string } = {},
): Promise<void> {
  const { fail = false, message = "Failed to submit whitelist request" } =
    options;

  await page.route(
    (url) => /\/pilot\/whitelist\/request$/.test(url.pathname),
    async (route) => {
      if (fail) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: "new-e2e-req", status: "pending" },
        }),
      });
    },
  );
}

/**
 * Mocks the pending-requests list and the approve/reject action used by
 * `WhitelistReviewQueue`, keeping them consistent with each other: an
 * approve or reject removes the request from the list the next time it's
 * fetched, the same way the real API would after a review decision.
 */
export async function mockWhitelistQueue(
  page: Page,
  initialRequests: WhitelistRequestFixture[],
  options: { delayMs?: number } = {},
): Promise<{ getRequests: () => WhitelistRequestFixture[] }> {
  let requests = [...initialRequests];
  const { delayMs = 0 } = options;

  await page.route(
    (url) => /\/pilot\/whitelist\/pending$/.test(url.pathname),
    async (route) => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: requests }),
      });
    },
  );

  await page.route(
    (url) => /\/pilot\/whitelist\/[^/]+\/review$/.test(url.pathname),
    (route) => {
      const match = /\/pilot\/whitelist\/([^/]+)\/review$/.exec(
        new URL(route.request().url()).pathname,
      );
      const id = match?.[1];
      requests = requests.filter((r) => r.id !== id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, txHash: "mock_tx_hash_e2e" }),
      });
    },
  );

  return { getRequests: () => requests };
}

/** Mocks `GET /pilot/whitelist/pending` returning an error, for the queue's error state. */
export async function mockWhitelistQueueError(page: Page): Promise<void> {
  await page.route(
    (url) => /\/pilot\/whitelist\/pending$/.test(url.pathname),
    (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Internal server error",
        }),
      }),
  );
}
