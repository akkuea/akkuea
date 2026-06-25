import { describe, expect, it, spyOn } from "bun:test";
import { fetchBalance, type HorizonServerLike } from "../stellar";

function makeServer(
  result: Promise<{ balances: Array<{ asset_type: string; balance: string }> }>,
): HorizonServerLike {
  return { loadAccount: () => result };
}

describe("fetchBalance", () => {
  it("returns status 'ok' with the native XLM balance for a funded account", async () => {
    const server = makeServer(
      Promise.resolve({
        balances: [
          { asset_type: "credit_alphanum4", balance: "50.0000000" },
          { asset_type: "native", balance: "100.5000000" },
        ],
      }),
    );
    const result = await fetchBalance("GABC1234", "testnet", server);
    expect(result).toEqual({ status: "ok", balance: "100.5000000" });
  });

  it("returns status 'not_found' for an account not yet on-chain (404)", async () => {
    const notFoundError = Object.assign(new Error("Not Found"), {
      response: { status: 404 },
    });
    const server = makeServer(Promise.reject(notFoundError));
    const result = await fetchBalance("GNOTFOUND", "testnet", server);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns status 'error' with message on a network error", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const networkError = new Error("Network timeout");
    const server = makeServer(Promise.reject(networkError));
    const result = await fetchBalance("GABC1234", "testnet", server);
    expect(result).toEqual({ status: "error", message: "Network timeout" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[fetchBalance]"),
      networkError,
    );
    warn.mockRestore();
  });
});
