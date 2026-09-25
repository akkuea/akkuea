import { test, expect } from "@playwright/test";
import { mockConnectedWallet, MOCK_OPERATOR_WALLET } from "./fixtures/wallet";
import { mockPilotRpc, PilotRpcScenario } from "./fixtures/soroban-rpc";

const MOCK_ALLY_WALLET =
  "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

test.describe("Evidence Lifecycle - Ally Workflow", () => {
  test("ally submits evidence with client-side hashing and enters submitted state", async ({
    page,
  }) => {
    const scenario = new PilotRpcScenario();
    await mockConnectedWallet(page, MOCK_ALLY_WALLET);
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/ally");

    // Verify page loads with connected ally form
    await expect(page.getByText("Monthly Income Evidence")).toBeVisible();

    // Select a file to trigger client-side hashing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "statement-march-2026.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("Mock PDF Statement Content for March 2026"),
    });

    // File name and hash should be displayed
    await expect(page.getByText("statement-march-2026.pdf")).toBeVisible();
    await expect(page.locator("p.text-emerald-400")).toBeVisible();

    // Fill link and income amount
    await page
      .getByPlaceholder("https://")
      .fill("https://example.com/statement.pdf");
    await page.getByPlaceholder("0.00").fill("12400.00");

    // Submit for review
    const submitButton = page.getByRole("button", {
      name: "Submit for Review",
    });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Submitted state confirmation
    await expect(
      page.getByText("Submitted for review, awaiting operator confirmation."),
    ).toBeVisible();
  });

  test("ally sees operator rejection reason and can resubmit", async ({
    page,
  }) => {
    const scenario = new PilotRpcScenario().setCycle({
      cycleId: "2026-03",
      status: "Rejected",
      totalIncome: BigInt(12_400_0000000),
      evidenceLink: "https://example.com/statement.pdf",
      evidenceHashHex:
        "4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f",
      submittedAt: Math.floor(Date.now() / 1000) - 86400,
      recordedAt: Math.floor(Date.now() / 1000) - 86400,
      reviewedAt: Math.floor(Date.now() / 1000),
      reviewReason: "The statement covers three weeks, not the full month.",
      distributed: false,
      distributedAt: 0,
    });

    await mockConnectedWallet(page, MOCK_ALLY_WALLET);
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/ally");

    // Operator reason is prominently displayed
    await expect(
      page.getByText("The statement covers three weeks, not the full month."),
    ).toBeVisible();

    // Form remains open and inputs are enabled for resubmission
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeEnabled();

    await fileInput.setInputFiles({
      name: "statement-march-corrected.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("Corrected full month PDF statement"),
    });

    await page
      .getByPlaceholder("https://")
      .fill("https://example.com/corrected.pdf");
    await page.getByPlaceholder("0.00").fill("12500.00");

    const submitButton = page.getByRole("button", {
      name: "Submit for Review",
    });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(
      page.getByText("Submitted for review, awaiting operator confirmation."),
    ).toBeVisible();
  });

  test("paused payout contract blocks ally submissions", async ({ page }) => {
    const scenario = new PilotRpcScenario().setPaused(true);

    await mockConnectedWallet(page, MOCK_ALLY_WALLET);
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/ally");

    await expect(
      page.getByText(
        "The payout contract is paused. New submissions cannot be processed.",
      ),
    ).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeDisabled();
    await expect(page.getByPlaceholder("https://")).toBeDisabled();
    await expect(page.getByPlaceholder("0.00")).toBeDisabled();
  });

  test("approved cycle shows locked state to ally", async ({ page }) => {
    const scenario = new PilotRpcScenario().setCycle({
      cycleId: "2026-03",
      status: "Approved",
      totalIncome: BigInt(12_400_0000000),
      evidenceLink: "https://example.com/statement.pdf",
      evidenceHashHex:
        "4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f",
      submittedAt: Math.floor(Date.now() / 1000) - 86400,
      recordedAt: Math.floor(Date.now() / 1000) - 86400,
      reviewedAt: Math.floor(Date.now() / 1000),
      reviewReason: "",
      distributed: false,
      distributedAt: 0,
    });

    await mockConnectedWallet(page, MOCK_ALLY_WALLET);
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/ally");

    await expect(
      page.getByText("Evidence for this cycle is already recorded on-chain."),
    ).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeDisabled();
  });
});

test.describe("Evidence Lifecycle - Operator Review Queue", () => {
  test("operator starts review and approves a submitted cycle", async ({
    page,
  }) => {
    const scenario = new PilotRpcScenario()
      .cycle("2026-03")
      .submitted(
        BigInt(12_400_0000000),
        "https://example.com/march-report.pdf",
        "4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f",
      );

    await mockConnectedWallet(page, MOCK_OPERATOR_WALLET);
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/review/evidence");

    // Verify queue displays reported income and link
    await expect(page.getByText("Evidence Review Queue")).toBeVisible();
    await expect(page.getByText("Reported 12,400.00 USDC")).toBeVisible();
    await expect(page.getByText("Open Statement")).toBeVisible();

    // Start review
    const startReviewBtn = page.getByRole("button", { name: "Start Review" });
    await expect(startReviewBtn).toBeVisible();
    await startReviewBtn.click();

    // After start review, approve the cycle
    const approveBtn = page.getByRole("button", { name: "Approve" });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
  });

  test("operator rejects a cycle with a required reason", async ({ page }) => {
    const scenario = new PilotRpcScenario()
      .cycle("2026-03")
      .submitted(
        BigInt(12_400_0000000),
        "https://example.com/march-report.pdf",
      );

    await mockConnectedWallet(page, MOCK_OPERATOR_WALLET);
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/review/evidence");

    const rejectBtn = page.getByRole("button", { name: "Reject" });
    // Reject is disabled while reason is empty
    await expect(rejectBtn).toBeDisabled();

    // Enter rejection reason
    const reasonInput = page.getByPlaceholder(
      "Required on rejection or dispute...",
    );
    await reasonInput.fill(
      "Discrepancy between bank records and reported revenue.",
    );
    await expect(rejectBtn).toBeEnabled();

    // Click reject
    await rejectBtn.click();
  });

  test("paused contract disables operator review actions", async ({ page }) => {
    const scenario = new PilotRpcScenario()
      .setPaused(true)
      .cycle("2026-03")
      .submitted(BigInt(12_400_0000000));

    await mockConnectedWallet(page, MOCK_OPERATOR_WALLET);
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/review/evidence");

    await expect(
      page.getByText(
        "The payout contract is paused. Review actions are unavailable.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reject" })).toBeDisabled();
  });
});

test.describe("Evidence Lifecycle - Investor Route", () => {
  test("investor timeline reflects on-time, late, disputed, and unreceived cycles", async ({
    page,
  }) => {
    const scenario = new PilotRpcScenario()
      .cycle("2026-01")
      .distributedOnTime(BigInt(11_750_0000000), 1770249600)
      .cycle("2026-02")
      .distributedLate(BigInt(11_750_0000000), 1773014400)
      .cycle("2026-03")
      .disputed("Bank statement total mismatch with property report")
      .setHoldings({
        balance: BigInt(250_0000000),
        totalSupply: BigInt(1_000_0000000),
        decimals: 7,
        symbol: "AKIN",
        whitelisted: true,
      });

    await mockConnectedWallet(
      page,
      "GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234",
    );
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/investor");

    // Verify timeline title and status badges
    await expect(page.getByText("Cycle Payment History")).toBeVisible();
    await expect(page.getByText("On time")).toBeVisible();
    await expect(page.getByText("Late")).toBeVisible();
    await expect(page.getByText("Disputed")).toBeVisible();

    // Verify dispute reason is rendered for investor
    await expect(
      page.getByText("Bank statement total mismatch with property report"),
    ).toBeVisible();

    // Verify investor holdings card calculations
    await expect(page.getByText("25.00%")).toBeVisible();
    await expect(page.getByText("Whitelisted")).toBeVisible();
  });

  test("investor timeline renders two-cycle escalation warning when ally misses 2 cycles", async ({
    page,
  }) => {
    const scenario = new PilotRpcScenario()
      .cycle("2026-01")
      .distributedOnTime(BigInt(11_750_0000000), 1770249600)
      .cycle("2026-02")
      .none()
      .cycle("2026-03")
      .none();

    await mockConnectedWallet(
      page,
      "GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234",
    );
    await mockPilotRpc(page, scenario);

    await page.goto("/en/pilot/investor");

    // Escalation alert must be visible
    await expect(
      page.getByText(/has not reported for 2 consecutive cycles/i),
    ).toBeVisible();
  });
});
