import { describe, it, expect, beforeEach } from "bun:test";
import { PollarProvider } from "../pollar";

function makeInterface(
  overrides: Partial<Parameters<PollarProvider["setPollarInterface"]>[0]> = {},
) {
  return {
    login: () => {},
    logout: () => {},
    getAddress: () => "GABC123",
    isAuthenticated: () => true,
    signTx: async () => "signed-xdr",
    ...overrides,
  };
}

describe("PollarProvider", () => {
  let provider: PollarProvider;

  beforeEach(() => {
    provider = new PollarProvider();
  });

  it("is not connected before interface is injected", () => {
    expect(provider.isConnected).toBe(false);
  });

  it("reflects isAuthenticated from injected interface", () => {
    provider.setPollarInterface(
      makeInterface({ isAuthenticated: () => false }),
    );
    expect(provider.isConnected).toBe(false);

    provider.setPollarInterface(makeInterface({ isAuthenticated: () => true }));
    expect(provider.isConnected).toBe(true);
  });

  it("connect() returns address when already authenticated", async () => {
    provider.setPollarInterface(makeInterface());
    const result = await provider.connect();
    expect(result.address).toBe("GABC123");
  });

  it("connect() calls login() when not authenticated", async () => {
    let loginCalled = false;
    provider.setPollarInterface(
      makeInterface({
        isAuthenticated: () => false,
        login: () => {
          loginCalled = true;
        },
        getAddress: () => "",
      }),
    );
    await provider.connect();
    expect(loginCalled).toBe(true);
  });

  it("connect() throws when interface not set", async () => {
    await expect(provider.connect()).rejects.toThrow(
      "Pollar SDK not initialized",
    );
  });

  it("disconnect() calls logout()", async () => {
    let logoutCalled = false;
    provider.setPollarInterface(
      makeInterface({
        logout: () => {
          logoutCalled = true;
        },
      }),
    );
    await provider.disconnect();
    expect(logoutCalled).toBe(true);
  });

  it("signTransaction() returns signed XDR", async () => {
    provider.setPollarInterface(
      makeInterface({ signTx: async () => "signed-result" }),
    );
    const result = await provider.signTransaction(
      "raw-xdr",
      "Test SDF Network ; September 2015",
    );
    expect(result).toBe("signed-result");
  });

  it("signTransaction() throws when interface not set", async () => {
    await expect(
      provider.signTransaction("raw-xdr", "Test SDF Network ; September 2015"),
    ).rejects.toThrow("Pollar SDK not initialized");
  });

  it("clears interface on setPollarInterface(null)", () => {
    provider.setPollarInterface(makeInterface());
    expect(provider.isConnected).toBe(true);
    provider.setPollarInterface(null);
    expect(provider.isConnected).toBe(false);
  });
});
