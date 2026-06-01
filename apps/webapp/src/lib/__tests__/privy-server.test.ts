import { describe, expect, test, mock, beforeEach } from "bun:test";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "../privy-env";

const mockVerifyAuthToken = mock(() =>
  Promise.resolve({
    appId: "test-app",
    issuer: "privy.io",
    issuedAt: 0,
    expiration: 9999999999,
    sessionId: "session-1",
    userId: "did:privy:user-1",
  }),
);

const mockGetUser = mock(() =>
  Promise.resolve({
    id: "did:privy:user-1",
    linkedAccounts: [
      {
        type: "wallet",
        id: "wallet-abc",
        address: "GABC1234567890123456789012345678901234567890123456789012345",
        chainType: "stellar",
        walletClientType: "privy",
      },
    ],
  }),
);

mock.module("@privy-io/server-auth", () => ({
  PrivyClient: class {
    verifyAuthToken = mockVerifyAuthToken;
    getUser = mockGetUser;
  },
}));

describe("verifyPrivyWalletOwnership", () => {
  beforeEach(async () => {
    process.env[PRIVY_APP_ID_ENV] = "test-app-id";
    process.env[PRIVY_APP_CREDENTIAL_ENV] = "test-app-credential";
    mockVerifyAuthToken.mockClear();
    mockGetUser.mockClear();
    const { resetPrivyClient } = await import("../privy-server");
    resetPrivyClient();
  });

  test("passes when user owns the Stellar wallet", async () => {
    const { verifyPrivyWalletOwnership } = await import("../privy-server");

    await expect(
      verifyPrivyWalletOwnership(
        "valid-token",
        "wallet-abc",
        "GABC1234567890123456789012345678901234567890123456789012345",
      ),
    ).resolves.toBeUndefined();

    expect(mockVerifyAuthToken).toHaveBeenCalledWith("valid-token");
    expect(mockGetUser).toHaveBeenCalledWith("did:privy:user-1");
  });

  test("rejects when wallet does not belong to user", async () => {
    const { verifyPrivyWalletOwnership } = await import("../privy-server");

    await expect(
      verifyPrivyWalletOwnership(
        "valid-token",
        "wallet-other",
        "GABC1234567890123456789012345678901234567890123456789012345",
      ),
    ).rejects.toThrow("Wallet does not belong to authenticated user.");
  });

  test("rejects when Privy credentials are missing", async () => {
    delete process.env[PRIVY_APP_ID_ENV];
    delete process.env[PRIVY_APP_CREDENTIAL_ENV];

    const { verifyPrivyWalletOwnership, resetPrivyClient } =
      await import("../privy-server");
    resetPrivyClient();

    await expect(
      verifyPrivyWalletOwnership("valid-token", "wallet-abc", "GABC"),
    ).rejects.toThrow("Privy credentials not configured on the server.");
  });
});
