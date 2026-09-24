import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

interface MockStaticKit {
  init: (opts: unknown) => void;
  authModal: () => Promise<{ address: string }>;
  signTransaction: (
    xdr: string,
    opts: { networkPassphrase?: string; address?: string },
  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
  signAuthEntry: (
    authEntry: string,
    opts: { networkPassphrase?: string; address?: string },
  ) => Promise<{ signedAuthEntry: string; signerAddress?: string }>;
}

function makeMockKit(overrides: Partial<MockStaticKit> = {}): MockStaticKit {
  return {
    init: () => {},
    authModal: async () => ({ address: "GADDRESS" }),
    signTransaction: async () => ({ signedTxXdr: "signed-tx-xdr" }),
    signAuthEntry: async () => ({ signedAuthEntry: "signed-auth-entry-xdr" }),
    ...overrides,
  };
}

let mockKit: MockStaticKit = makeMockKit();

mock.module("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: {
    init: (opts: unknown) => mockKit.init(opts),
    authModal: () => mockKit.authModal(),
    signTransaction: (xdr: string, opts: unknown) =>
      mockKit.signTransaction(xdr, opts as { networkPassphrase?: string }),
    signAuthEntry: (authEntry: string, opts: unknown) =>
      mockKit.signAuthEntry(authEntry, opts as { networkPassphrase?: string }),
  },
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
}));

mock.module("@creit.tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: () => [],
}));

const { StellarWalletsKitProvider } = await import(
  "../stellar-wallets-kit.provider"
);

const TEST_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

describe("StellarWalletsKitProvider", () => {
  let provider: InstanceType<typeof StellarWalletsKitProvider>;

  beforeEach(() => {
    mockKit = makeMockKit();
    provider = new StellarWalletsKitProvider();
  });

  afterEach(() => {
    mock.restore();
  });

  it("is not connected before connect() succeeds", () => {
    expect(provider.isConnected).toBe(false);
  });

  it("connect() opens the auth modal and reports connected on success", async () => {
    const result = await provider.connect();
    expect(result.address).toBe("GADDRESS");
    expect(provider.isConnected).toBe(true);
  });

  it("connect() reports not connected when the auth modal rejects", async () => {
    mockKit.authModal = async () => {
      throw new Error("user closed modal");
    };
    await expect(provider.connect()).rejects.toThrow("user closed modal");
    expect(provider.isConnected).toBe(false);
  });

  it("signTransaction() throws before connect() has run", async () => {
    await expect(
      provider.signTransaction("raw-xdr", TEST_NETWORK_PASSPHRASE),
    ).rejects.toThrow("Stellar wallet is not connected. Call connect() first.");
  });

  it("signTransaction() returns the signed XDR after connecting", async () => {
    await provider.connect();
    const result = await provider.signTransaction(
      "raw-xdr",
      TEST_NETWORK_PASSPHRASE,
    );
    expect(result).toBe("signed-tx-xdr");
  });

  it("signAuthEntry() throws before connect() has run", async () => {
    await expect(
      provider.signAuthEntry(
        "raw-auth-entry-xdr",
        "GOPERATOR",
        TEST_NETWORK_PASSPHRASE,
      ),
    ).rejects.toThrow("Stellar wallet is not connected. Call connect() first.");
  });

  it("signAuthEntry() returns the signed auth entry after connecting", async () => {
    await provider.connect();
    const result = await provider.signAuthEntry(
      "raw-auth-entry-xdr",
      "GOPERATOR",
      TEST_NETWORK_PASSPHRASE,
    );
    expect(result).toBe("signed-auth-entry-xdr");
  });

  it("signAuthEntry() passes the signer address and network through to the kit", async () => {
    let received: { networkPassphrase?: string; address?: string } = {};
    mockKit.signAuthEntry = async (_authEntry, opts) => {
      received = opts;
      return { signedAuthEntry: "signed" };
    };

    await provider.connect();
    await provider.signAuthEntry(
      "raw-auth-entry-xdr",
      "GALLY",
      TEST_NETWORK_PASSPHRASE,
    );

    expect(received.address).toBe("GALLY");
    expect(received.networkPassphrase).toBe(TEST_NETWORK_PASSPHRASE);
  });

  it("signAuthEntry() propagates a wallet's unsupported-operation rejection", async () => {
    mockKit.signAuthEntry = async () => {
      throw new Error('Albedo does not support the "signAuthEntry" function');
    };

    await provider.connect();
    await expect(
      provider.signAuthEntry(
        "raw-auth-entry-xdr",
        "GOPERATOR",
        TEST_NETWORK_PASSPHRASE,
      ),
    ).rejects.toThrow('does not support the "signAuthEntry" function');
  });

  it("disconnect() reports not connected", async () => {
    await provider.connect();
    await provider.disconnect();
    expect(provider.isConnected).toBe(false);
  });
});
