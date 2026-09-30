import { test, expect } from "@playwright/test";
import { mockConnectedWallet } from "./fixtures/wallet";
import {
  mockWhitelistStatus,
  mockWhitelistSubmit,
} from "./fixtures/whitelist-api";

/**
 * Covers the four states `WhitelistOnboardingForm` must handle: loading,
 * error, success, and disconnected-wallet.
 */
test.describe("WhitelistOnboardingForm", () => {
  test("disconnected wallet: blocks progress past the wallet step until a wallet is connected", async ({
    page,
  }) => {
    // No mockConnectedWallet() call: the app starts with no wallet connected.
    await mockWhitelistStatus(page, { status: "none" });

    await page.goto("/en/pilot/onboarding");

    await expect(page.getByText("No Whitelist Application")).toBeVisible();

    await page.getByRole("button", { name: "Start Application" }).click();

    await page.getByPlaceholder("John Doe").fill("Jane Tester");
    await page.getByPlaceholder("Document Number").fill("P-00000000"); // Step 2 (ID document) gates "Continue" on an uploaded file; pick one.
    // The file input is visually hidden and linked only to the inner
    // "Upload ID Document" label, so target it by its id.
    await page.locator("#document-upload").setInputFiles({
      name: "passport.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
          "1f15c4890000000a49444154789c6300010000050001" +
          "0d0a2db40000000049454e44ae426082",
        "hex",
      ),
    });

    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 is the wallet step: it has no connect UI of its own (the app
    // auto-advances the moment a wallet connects), and the stepper's own
    // "Continue" stays disabled while disconnected, so the form can't be
    // pushed into the review step without a wallet.
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("loading: shows a loading indicator while the whitelist status is being checked", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistStatus(page, { status: "none", delayMs: 1000 });

    await page.goto("/en/pilot/onboarding");

    await expect(
      page.getByText("Loading your whitelist status..."),
    ).toBeVisible();
    await expect(page.getByText("Loading your whitelist status...")).toBeHidden(
      { timeout: 5000 },
    );

    await expect(page.getByText("No Whitelist Application")).toBeVisible();
  });

  test("error: shows an error message when the submission fails", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistStatus(page, { status: "none" });
    await mockWhitelistSubmit(page, {
      fail: true,
      message: "Server error, please try again later.",
    });

    await page.goto("/en/pilot/onboarding");
    await page.getByRole("button", { name: "Start Application" }).click();

    await page.getByPlaceholder("John Doe").fill("Jane Tester");
    await page.getByPlaceholder("Document Number").fill("P-00000000"); // Step 2 (ID document) gates "Continue" on an uploaded file; the
    // visually-hidden input is targeted by id.
    await page.locator("#document-upload").setInputFiles({
      name: "passport.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
          "1f15c4890000000a49444154789c6300010000050001" +
          "0d0a2db40000000049454e44ae426082",
        "hex",
      ),
    });

    await page.getByRole("button", { name: "Continue" }).click();

    // The wallet step auto-advances past step 3 (wallet already connected),
    // landing straight on step 4 (review).
    await expect(
      page.getByRole("button", { name: "Submit Request" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Submit Request" }).click();

    // apiClient retries 5xx responses (up to 3 times with backoff) before
    // surfacing the failure, so give this assertion more room than the
    // suite's default.
    await expect(
      page.getByText("Server error, please try again later."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("success: submits the application and shows the pending-review state", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistStatus(page, { status: "none" });
    await mockWhitelistSubmit(page, { fail: false });

    await page.goto("/en/pilot/onboarding");
    await page.getByRole("button", { name: "Start Application" }).click();

    await page.getByPlaceholder("John Doe").fill("Jane Tester");
    await page.getByPlaceholder("Document Number").fill("P-00000000"); // Step 2 (ID document) gates "Continue" on an uploaded file; the
    // visually-hidden input is targeted by id.
    await page.locator("#document-upload").setInputFiles({
      name: "passport.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
          "1f15c4890000000a49444154789c6300010000050001" +
          "0d0a2db40000000049454e44ae426082",
        "hex",
      ),
    });

    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Jane Tester")).toBeVisible();
    await page.getByRole("button", { name: "Submit Request" }).click();

    await expect(
      page.getByRole("heading", { name: "Review Pending" }),
    ).toBeVisible();
  });
});
