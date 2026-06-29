// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
(dom.window as any).fetch = fetch;
globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
globalThis.navigator = dom.window.navigator as any;
globalThis.HTMLElement = dom.window.HTMLElement as any;
globalThis.MutationObserver = dom.window.MutationObserver as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useGameWallet, useWalletStore } from "../useGameWallet";

const DEFAULT_ADDRESS =
  process.env.NEXT_PUBLIC_DEFAULT_VIEWER_ADDRESS ?? "";

describe("useGameWallet", () => {
  beforeEach(() => {
    cleanup();
    useWalletStore.setState({
      isConnected: true,
      address: DEFAULT_ADDRESS,
    });
  });

  describe("login — sets wallet address in state", () => {
    it("sets isConnected to true and address to the default address", () => {
      useWalletStore.setState({ isConnected: false, address: null });

      const { result } = renderHook(() => useGameWallet());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.address).toBeNull();

      act(() => {
        result.current.login();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(DEFAULT_ADDRESS);
    });
  });

  describe("logout — clears address and connection from state", () => {
    it("sets isConnected to false and address to null", () => {
      const { result } = renderHook(() => useGameWallet());

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.logout();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.address).toBeNull();
    });
  });

  describe("signAndSubmitTx — success path", () => {
    it("resolves without throwing and logs the XDR payload", async () => {
      const consoleSpy = spyOn(console, "log");

      const { result } = renderHook(() => useGameWallet());

      await act(async () => {
        await result.current.signAndSubmitTx("mock-xdr-payload");
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Simulating transaction submission for XDR:",
        "mock-xdr-payload",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("signAndSubmitTx — error propagation", () => {
    it("propagates errors without corrupting wallet state", async () => {
      const { result } = renderHook(() => useGameWallet());

      const originalSignAndSubmitTx = result.current.signAndSubmitTx;
      const errorTx = async (xdr: string) => {
        await originalSignAndSubmitTx(xdr);
        throw new Error("RPC error: network unavailable");
      };

      let caughtError: Error | null = null;
      await act(async () => {
        try {
          await errorTx("bad-xdr");
        } catch (e) {
          caughtError = e as Error;
        }
      });

      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe("RPC error: network unavailable");

      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(DEFAULT_ADDRESS);
    });
  });
});
