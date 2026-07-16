/**
 * claim-rental — unit tests
 *
 * Verifies that claimAllRentals:
 *  1. Builds a real claim_rental XDR per property and passes it to the wallet,
 *     then submits the SIGNED XDR and waits for confirmation (regression
 *     against the old dashboard code that signed a hardcoded placeholder and
 *     discarded the result).
 *  2. Continues past per-property failures and records human-readable reasons.
 *
 * Also covers the describeClaimError mapping table.
 */

import { describe, it, expect, vi, beforeEach } from "bun:test";

// ── Shared mock data ─────────────────────────────────────────────────────────

const VIEWER = "GDVIEWER1234567890123456789012345678901234567890123456";
const MOCK_UNSIGNED_XDR = "AAAA_UNSIGNED_XDR_BASE64==";
const MOCK_SIGNED_XDR = "AAAA_SIGNED_XDR_BASE64==";
const MOCK_TX_HASH =
  "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const OLD_PLACEHOLDER_XDR = "AAAAAgAAAAD5r+Hl5S94D......";

// ── Module mocks — must be declared before importing the module under test ──

vi.mock("@/lib/soroban-tx", () => ({
  buildClaimIncomeXdr: vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR),
  submitSorobanTx: vi.fn().mockResolvedValue(MOCK_TX_HASH),
  waitForSorobanTx: vi.fn().mockResolvedValue("success"),
  NETWORK_PASSPHRASE,
}));

// ── Import after mocks are set up ────────────────────────────────────────────

import {
  buildClaimIncomeXdr,
  submitSorobanTx,
  waitForSorobanTx,
} from "@/lib/soroban-tx";
import { claimAllRentals, describeClaimError } from "@/lib/claim-rental";

const buildMock = buildClaimIncomeXdr as ReturnType<typeof vi.fn>;
const submitMock = submitSorobanTx as ReturnType<typeof vi.fn>;
const waitMock = waitForSorobanTx as ReturnType<typeof vi.fn>;

const mockSignTransaction = vi
  .fn()
  .mockResolvedValue({ signedTxXdr: MOCK_SIGNED_XDR });

const kit = { signTransaction: mockSignTransaction };

const PROPERTIES = [
  { id: "prop-0-1", name: "Oasis Ridge Estate" },
  { id: "prop-0-2", name: "Neo Tokyo Sector 9" },
];

beforeEach(() => {
  vi.clearAllMocks();
  buildMock.mockResolvedValue(MOCK_UNSIGNED_XDR);
  submitMock.mockResolvedValue(MOCK_TX_HASH);
  waitMock.mockResolvedValue("success");
  mockSignTransaction.mockResolvedValue({ signedTxXdr: MOCK_SIGNED_XDR });
});

// ── claimAllRentals ──────────────────────────────────────────────────────────

describe("claimAllRentals — success path", () => {
  it("builds, signs, submits, and confirms one real transaction per property", async () => {
    const onProgress = vi.fn();
    const onClaimed = vi.fn();

    const { failures } = await claimAllRentals({
      kit,
      viewerAddress: VIEWER,
      properties: PROPERTIES,
      onProgress,
      onClaimed,
    });

    expect(failures).toEqual([]);

    // XDR built per property with the viewer address
    expect(buildMock).toHaveBeenCalledTimes(2);
    expect(buildMock).toHaveBeenNthCalledWith(1, VIEWER, "prop-0-1");
    expect(buildMock).toHaveBeenNthCalledWith(2, VIEWER, "prop-0-2");

    // Wallet signs the built XDR with the correct network + address
    expect(mockSignTransaction).toHaveBeenCalledTimes(2);
    expect(mockSignTransaction).toHaveBeenCalledWith(MOCK_UNSIGNED_XDR, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address: VIEWER,
    });

    // The SIGNED XDR is submitted (regression: old code discarded the result)
    expect(submitMock).toHaveBeenCalledTimes(2);
    expect(submitMock).toHaveBeenCalledWith(MOCK_SIGNED_XDR);

    // Confirmation is awaited per submission
    expect(waitMock).toHaveBeenCalledTimes(2);
    expect(waitMock).toHaveBeenCalledWith(MOCK_TX_HASH);

    expect(onProgress).toHaveBeenNthCalledWith(1, 0);
    expect(onProgress).toHaveBeenNthCalledWith(2, 1);
    expect(onClaimed).toHaveBeenNthCalledWith(1, "prop-0-1");
    expect(onClaimed).toHaveBeenNthCalledWith(2, "prop-0-2");
  });

  it("never signs the old hardcoded placeholder XDR", async () => {
    await claimAllRentals({
      kit,
      viewerAddress: VIEWER,
      properties: PROPERTIES,
    });

    for (const call of mockSignTransaction.mock.calls) {
      expect(call[0]).not.toBe(OLD_PLACEHOLDER_XDR);
    }
  });
});

describe("claimAllRentals — failure handling", () => {
  it("records a wallet rejection and still claims the next property", async () => {
    mockSignTransaction.mockRejectedValueOnce(new Error("User rejected"));
    const onClaimed = vi.fn();

    const { failures } = await claimAllRentals({
      kit,
      viewerAddress: VIEWER,
      properties: PROPERTIES,
      onClaimed,
    });

    expect(failures).toEqual(["Oasis Ridge Estate — wallet signing rejected"]);

    // Second property completed the full flow
    expect(onClaimed).toHaveBeenCalledTimes(1);
    expect(onClaimed).toHaveBeenCalledWith("prop-0-2");
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("records an on-chain failure and does not fire onClaimed for it", async () => {
    waitMock.mockRejectedValueOnce(
      new Error("Transaction failed on-chain. Result XDR: AAAA=="),
    );
    const onClaimed = vi.fn();

    const { failures } = await claimAllRentals({
      kit,
      viewerAddress: VIEWER,
      properties: [PROPERTIES[0]],
      onClaimed,
    });

    expect(failures).toEqual([
      "Oasis Ridge Estate — Transaction failed on-chain. Result XDR: AAAA==",
    ]);
    expect(onClaimed).not.toHaveBeenCalled();
  });

  it("maps a NothingToClaim simulation failure to a friendly message", async () => {
    buildMock.mockRejectedValueOnce(
      new Error(
        "Soroban simulation failed for claim_rental: HostError: Error(Contract, #4)",
      ),
    );

    const { failures } = await claimAllRentals({
      kit,
      viewerAddress: VIEWER,
      properties: [PROPERTIES[0]],
    });

    expect(failures).toEqual([
      "Oasis Ridge Estate — nothing to claim yet (wait one epoch)",
    ]);
    expect(mockSignTransaction).not.toHaveBeenCalled();
  });
});

// ── describeClaimError ───────────────────────────────────────────────────────

describe("describeClaimError", () => {
  const cases: Array<[string, string]> = [
    ["User rejected", "wallet signing rejected"],
    ["Request denied by wallet", "wallet signing rejected"],
    ["Signing declined", "wallet signing rejected"],
    [
      "HostError: Error(Contract, #2)",
      "not the on-chain owner of this property",
    ],
    ["HostError: Error(Contract, #4)", "nothing to claim yet (wait one epoch)"],
    ["HostError: Error(Contract, #5)", "insufficient balance"],
    [
      "Transaction submission rejected by node: AAAA==",
      "submission rejected (check XLM fee balance)",
    ],
    ["something unexpected happened", "something unexpected happened"],
  ];

  for (const [input, expected] of cases) {
    it(`maps "${input}" → "${expected}"`, () => {
      expect(describeClaimError(new Error(input))).toBe(expected);
    });
  }

  it("stringifies non-Error values", () => {
    expect(describeClaimError("plain string failure")).toBe(
      "plain string failure",
    );
  });
});
