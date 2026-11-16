import { test, expect } from "@playwright/test";
import { mockConnectedWallet } from "./fixtures/wallet";
import {
  mockWhitelistStatus,
  mockWhitelistSubmit,
} from "./fixtures/whitelist-api";

/**
 * Covers the states `WhitelistOnboardingForm` handles in English and Spanish:
 * loading, error, success, disconnected-wallet, approved, and rejected.
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
    await page.getByPlaceholder("Document Number").fill("P-00000000");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Connect Your Wallet" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect Wallet" }),
    ).toBeVisible();

    // The stepper's own "Continue" is disabled while disconnected, so the
    // form can't be pushed into the review step without a wallet.
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
    await page.getByPlaceholder("Document Number").fill("P-00000000");
    // With the wallet already connected, submitting step 1 auto-advances
    // past the wallet-connection step straight to the review step.
    await page.getByRole("button", { name: "Continue" }).click();

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
    await page.getByPlaceholder("Document Number").fill("P-00000000");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Jane Tester")).toBeVisible();
    await page.getByRole("button", { name: "Submit Request" }).click();

    await expect(
      page.getByRole("heading", { name: "Review Pending" }),
    ).toBeVisible();
  });

  test("back from review returns to the wallet step even when already connected", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistStatus(page, { status: "none" });

    await page.goto("/en/pilot/onboarding");
    await page.getByRole("button", { name: "Start Application" }).click();
    await page.getByPlaceholder("John Doe").fill("Jane Tester");
    await page.getByPlaceholder("Document Number").fill("P-00000000");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByRole("button", { name: "Submit Request" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    await expect(
      page.getByRole("heading", { name: "Connect Your Wallet" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect Wallet" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("es locale: renders the onboarding flow and pending state in Spanish", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistStatus(page, { status: "none" });
    await mockWhitelistSubmit(page, { fail: false });

    await page.goto("/es/pilot/onboarding");
    await expect(page.getByText("Sin solicitud de lista blanca")).toBeVisible();

    await page.getByRole("button", { name: "Iniciar solicitud" }).click();
    await page.getByPlaceholder("Juan Pérez").fill("Ana Prueba");
    await page.getByPlaceholder("Número de referencia").fill("P-00000000");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText("Ana Prueba")).toBeVisible();
    await page.getByRole("button", { name: "Enviar solicitud" }).click();

    await expect(
      page.getByRole("heading", { name: "Revisión pendiente" }),
    ).toBeVisible();
  });

  test("es locale: renders approved and rejected states in Spanish", async ({
    page,
  }) => {
    await mockConnectedWallet(page);
    await mockWhitelistStatus(page, { status: "approved" });

    await page.goto("/es/pilot/onboarding");
    await expect(
      page.getByRole("heading", { name: "Estás en la lista blanca" }),
    ).toBeVisible();

    await mockWhitelistStatus(page, {
      status: "rejected",
      rejectionReason: "Documento vencido",
    });
    await page.reload();

    await expect(
      page.getByRole("heading", { name: "Solicitud rechazada" }),
    ).toBeVisible();
    await expect(page.getByText("Motivo:")).toBeVisible();
    await expect(page.getByText("Documento vencido")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Volver a solicitar" }),
    ).toBeVisible();
  });
});
