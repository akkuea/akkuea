import { describe, expect, it } from "bun:test";
import {
  canSignAuthEntries,
  isSignableWalletProvider,
  type WalletProvider,
} from "../types";

function baseProvider(): WalletProvider {
  return {
    id: "test-provider",
    name: "Test Provider",
    isConnected: true,
    connect: async () => ({ address: "GADDRESS" }),
    disconnect: async () => {},
  };
}

describe("isSignableWalletProvider", () => {
  it("is false for a provider with no signTransaction", () => {
    expect(isSignableWalletProvider(baseProvider())).toBe(false);
  });

  it("is true for a provider with a signTransaction function", () => {
    const provider = {
      ...baseProvider(),
      signTransaction: async () => "signed",
    };
    expect(isSignableWalletProvider(provider)).toBe(true);
  });
});

describe("canSignAuthEntries", () => {
  it("is false for a provider with neither method", () => {
    expect(canSignAuthEntries(baseProvider())).toBe(false);
  });

  it("is false for a provider that can sign transactions but not auth entries (e.g. Privy, Pollar)", () => {
    const provider = {
      ...baseProvider(),
      signTransaction: async () => "signed",
    };
    expect(canSignAuthEntries(provider)).toBe(false);
  });

  it("is false for a provider that only exposes signAuthEntry without signTransaction", () => {
    // Not a real provider shape in this codebase, but guards against a
    // future provider that only partially implements the interface.
    const provider = {
      ...baseProvider(),
      signAuthEntry: async () => "signed",
    };
    expect(canSignAuthEntries(provider)).toBe(false);
  });

  it("is true for a provider implementing both signTransaction and signAuthEntry", () => {
    const provider = {
      ...baseProvider(),
      signTransaction: async () => "signed-tx",
      signAuthEntry: async () => "signed-auth-entry",
    };
    expect(canSignAuthEntries(provider)).toBe(true);
  });
});
