import { test, expect } from "@playwright/test";
import { mockConnectedWallet } from "./fixtures/wallet";
import {
  buildWhitelistRequest,
  mockWhitelistQueue,
  mockWhitelistQueueError,
} from "./fixtures/whitelist-api";

/**
 * Covers `WhitelistReviewQueue`'s approve and reject actions, plus its
 * loading and error states as an operator navigating to the queue would
 * encounter them.
 */
test.describe("WhitelistReviewQueue", () => {
  test("loading: shows a loading indicator while requests are being fetched", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistQueue(page, [buildWhitelistRequest()], {
      delayMs: 1000,
    });

    await page.goto("/en/pilot/review/whitelist");

    await expect(page.getByText("Loading pending requests...")).toBeVisible();
    await expect(page.getByText("Maria Santos")).toBeVisible({
      timeout: 5000,
    });
  });

  test("error: shows a retry fallback when the queue fails to load", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistQueueError(page);

    await page.goto("/en/pilot/review/whitelist");

    await expect(
      page.getByText("Failed to load whitelist queue"),
    ).toBeVisible();

    // Retry re-runs the same (still failing) fetch; the fallback should stay
    // visible rather than the UI getting stuck in an inconsistent state.
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(
      page.getByText("Failed to load whitelist queue"),
    ).toBeVisible();
  });

  test("approve: approving a request removes it from the pending queue", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistQueue(page, [buildWhitelistRequest()]);

    await page.goto("/en/pilot/review/whitelist");

    await expect(page.getByText("Maria Santos")).toBeVisible();
    await page.getByRole("button", { name: "Review" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Approve & Whitelist" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("No Pending Requests")).toBeVisible();
  });

  test("reject: requires a reason, then removes the request once rejected", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistQueue(page, [buildWhitelistRequest()]);

    await page.goto("/en/pilot/review/whitelist");

    await page.getByRole("button", { name: "Review" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const rejectButton = dialog.getByRole("button", {
      name: "Reject Request",
    });
    await expect(rejectButton).toBeDisabled();

    await dialog
      .getByPlaceholder("Required if rejecting...")
      .fill("Unable to verify the submitted ID reference.");
    await expect(rejectButton).toBeEnabled();
    await rejectButton.click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("No Pending Requests")).toBeVisible();
  });
});
