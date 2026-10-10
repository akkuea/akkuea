import "@/test/setup-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import type {
  AuthEntrySigningProvider,
  SignableWalletProvider,
} from "@/services/wallet";

interface MockKit {
  authModal: () => Promise<{ address: string }>;
  selectedModule: { productId: string };
  getAddress: () => Promise<{ address: string }>;
  getNetwork: () => Promise<{ networkPassphrase: string }>;
}

let mockKit: MockKit | null = null;

mock.module("../../constant/walletKit", () => ({
  initializeWalletKit: () => {},
  getWalletKit: () => mockKit,
}));

const fetchBalanceMock = mock(() =>
  Promise.resolve({ status: "ok" as const, balance: "100" }),
);
mock.module("@/lib/stellar", () => ({
  fetchBalance: fetchBalanceMock,
}));

// PropertyPage's and the marketplace page's tests each mock.module() the
// "@/components/auth/hooks" barrel and never restore it. Once that specifier
// has been mocked from more than one file in the same `bun test` process,
// Bun's module resolution also starts returning that stub for a plain
// "../useWallet.hook" import here, even though this file never touches the
// barrel itself. A cache-busting query string forces a fresh module load
// that isn't subject to that stale resolution.
const freshWalletHookSpecifier: string = "../useWallet.hook.ts?fresh-import";
const { useWallet } = await import(freshWalletHookSpecifier);
const { useAuthenticationStore } =
  await import("../../store/data/slices/authentication.slice");
const { walletRegistry, StellarWalletsKitProvider } =
  await import("@/services/wallet");

const TEST_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

function resetStore() {
  useAuthenticationStore.setState({
    address: null,
    balance: null,
    balanceStatus: null,
    balanceError: null,
    isConnected: false,
    isConnecting: false,
    isWalletDisconnected: false,
    pendingAction: null,
    selectedWalletId: null,
    network: "testnet",
  });
}

function makeMockKit(overrides: Partial<MockKit> = {}): MockKit {
  return {
    getAddress: async () => ({ address: "GADDRESSRECONNECTED" }),
    getNetwork: async () => ({ networkPassphrase: TEST_NETWORK_PASSPHRASE }),
    selectedModule: { productId: "freighter" },
    authModal: async () => {
      throw { code: -1, message: "The user closed the modal." };
    },
    ...overrides,
  };
}

describe("useWallet - reconnection flow", () => {
  beforeEach(() => {
    resetStore();
    mockKit = null;
    fetchBalanceMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the reconnection prompt visible if the wallet-selection modal is cancelled", async () => {
    useAuthenticationStore.setState({ isWalletDisconnected: true });
    mockKit = makeMockKit();

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.reconnect();
    });

    // The legacy connect() path resolves even when the user closes the
    // modal without picking a wallet - reconnect() must not treat that as
    // a successful reconnection.
    expect(useAuthenticationStore.getState().isWalletDisconnected).toBe(true);
    expect(useAuthenticationStore.getState().isConnected).toBe(false);
  });

  it("clears the prompt and resumes the pending action once reconnection succeeds", async () => {
    const pendingAction = mock(() => Promise.resolve("signed-xdr"));
    useAuthenticationStore.setState({
      isWalletDisconnected: true,
      pendingAction,
    });
    mockKit = makeMockKit({
      authModal: async () => ({ address: "GADDRESSRECONNECTED" }),
    });

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.reconnect();
    });

    const state = useAuthenticationStore.getState();
    expect(state.isWalletDisconnected).toBe(false);
    expect(state.pendingAction).toBeNull();
    expect(pendingAction).toHaveBeenCalledTimes(1);
  });

  it("re-arms the prompt with the same pending action if resuming it fails again", async () => {
    const pendingAction = mock(() =>
      Promise.reject(new Error("still failing")),
    );
    useAuthenticationStore.setState({
      isWalletDisconnected: true,
      pendingAction,
    });
    mockKit = makeMockKit({
      authModal: async () => ({ address: "GADDRESSRECONNECTED" }),
    });

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.reconnect();
    });

    const state = useAuthenticationStore.getState();
    expect(state.isWalletDisconnected).toBe(true);
    expect(state.pendingAction).toBe(pendingAction);
  });

  it("a failed reconnect attempt (resetSession) does not clear isWalletDisconnected", async () => {
    useAuthenticationStore.setState({ isWalletDisconnected: true });
    mockKit = makeMockKit({
      // A genuine kit failure (not a user-cancelled modal) after selection
      // forces the catch branch (store.resetSession()).
      authModal: async () => {
        throw new Error("kit unavailable");
      },
    });

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.reconnect();
    });

    const state = useAuthenticationStore.getState();
    expect(state.isWalletDisconnected).toBe(true);
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
  });
});

describe("useAuthenticationStore - reconnection state", () => {
  beforeEach(() => {
    resetStore();
  });

  it("triggerReconnectionPrompt sets the flag and queues the given action", () => {
    const action = mock(() => Promise.resolve());
    useAuthenticationStore.getState().triggerReconnectionPrompt(action);

    const state = useAuthenticationStore.getState();
    expect(state.isWalletDisconnected).toBe(true);
    expect(state.pendingAction).toBe(action);
  });

  it("triggerReconnectionPrompt called without an action preserves an already-queued one", () => {
    const action = mock(() => Promise.resolve());
    useAuthenticationStore.getState().triggerReconnectionPrompt(action);

    // Simulates the passive focus-probe firing after a sign attempt already
    // queued a pending action - it must not clobber it.
    useAuthenticationStore.getState().triggerReconnectionPrompt();

    const state = useAuthenticationStore.getState();
    expect(state.isWalletDisconnected).toBe(true);
    expect(state.pendingAction).toBe(action);
  });

  it("clearReconnectionPrompt resets both the flag and the pending action", () => {
    const action = mock(() => Promise.resolve());
    useAuthenticationStore.getState().triggerReconnectionPrompt(action);
    useAuthenticationStore.getState().clearReconnectionPrompt();

    const state = useAuthenticationStore.getState();
    expect(state.isWalletDisconnected).toBe(false);
    expect(state.pendingAction).toBeNull();
  });

  it("resetSession clears session fields but preserves the reconnection prompt state", () => {
    const action = mock(() => Promise.resolve());
    useAuthenticationStore.setState({
      address: "GADDRESS",
      isConnected: true,
      selectedWalletId: "freighter",
      isWalletDisconnected: true,
      pendingAction: action,
    });

    useAuthenticationStore.getState().resetSession();

    const state = useAuthenticationStore.getState();
    expect(state.address).toBeNull();
    expect(state.isConnected).toBe(false);
    expect(state.selectedWalletId).toBeNull();
    // The whole point of resetSession vs. reset(): the reconnection banner
    // and its queued action must survive a failed (re)connect attempt.
    expect(state.isWalletDisconnected).toBe(true);
    expect(state.pendingAction).toBe(action);
  });

  it("reset (full disconnect) clears the reconnection prompt state too", () => {
    const action = mock(() => Promise.resolve());
    useAuthenticationStore.setState({
      isWalletDisconnected: true,
      pendingAction: action,
    });

    useAuthenticationStore.getState().reset();

    const state = useAuthenticationStore.getState();
    expect(state.isWalletDisconnected).toBe(false);
    expect(state.pendingAction).toBeNull();
  });
});

/** A minimal provider that can sign both transactions and auth entries. */
function makeAuthEntrySigningProvider(
  overrides: Partial<AuthEntrySigningProvider> = {},
): AuthEntrySigningProvider {
  return {
    id: "test-auth-entry-signer",
    name: "Test Auth Entry Signer",
    isConnected: true,
    connect: async () => ({ address: "GADDRESS" }),
    disconnect: async () => {},
    signTransaction: async () => "signed-tx-xdr",
    signAuthEntry: async () => "signed-auth-entry-xdr",
    ...overrides,
  };
}

describe("useWallet - signAuthEntry / canSignAuthEntries", () => {
  beforeEach(() => {
    resetStore();
    mockKit = null;
    fetchBalanceMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("canSignAuthEntries is false when no wallet is selected", () => {
    const { result } = renderHook(() => useWallet());
    expect(result.current.canSignAuthEntries).toBe(false);
  });

  it("canSignAuthEntries is false for a provider that only signs transactions (e.g. Privy, Pollar)", () => {
    const txOnlyProvider: SignableWalletProvider = {
      id: "test-tx-only-signer",
      name: "Test Transaction-Only Signer",
      isConnected: true,
      connect: async () => ({ address: "GADDRESS" }),
      disconnect: async () => {},
      signTransaction: async () => "signed-tx-xdr",
    };
    walletRegistry.register(txOnlyProvider);
    useAuthenticationStore.setState({
      selectedWalletId: "test-tx-only-signer",
    });

    const { result } = renderHook(() => useWallet());
    expect(result.current.canSignAuthEntries).toBe(false);
  });

  it("canSignAuthEntries is true for a provider that can sign auth entries", () => {
    walletRegistry.register(makeAuthEntrySigningProvider());
    useAuthenticationStore.setState({
      selectedWalletId: "test-auth-entry-signer",
    });

    const { result } = renderHook(() => useWallet());
    expect(result.current.canSignAuthEntries).toBe(true);
  });

  it("signAuthEntry() throws immediately, without a reconnection prompt, when the wallet cannot sign auth entries at all", async () => {
    const { result } = renderHook(() => useWallet());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.signAuthEntry(
          "raw-auth-entry-xdr",
          "GOPERATOR",
          TEST_NETWORK_PASSPHRASE,
        );
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      "Connected wallet does not support signing authorization entries",
    );
    expect(useAuthenticationStore.getState().isWalletDisconnected).toBe(false);
  });

  it("signAuthEntry() returns the signed auth entry from a capable provider", async () => {
    walletRegistry.register(
      makeAuthEntrySigningProvider({
        signAuthEntry: async (authEntryXdr, signerAddress, network) =>
          `signed:${authEntryXdr}:${signerAddress}:${network}`,
      }),
    );
    useAuthenticationStore.setState({
      selectedWalletId: "test-auth-entry-signer",
    });

    const { result } = renderHook(() => useWallet());
    let signed = "";
    await act(async () => {
      signed = await result.current.signAuthEntry(
        "raw-auth-entry-xdr",
        "GOPERATOR",
        TEST_NETWORK_PASSPHRASE,
      );
    });

    expect(signed).toBe(
      `signed:raw-auth-entry-xdr:GOPERATOR:${TEST_NETWORK_PASSPHRASE}`,
    );
  });

  it("signAuthEntry() triggers the reconnection prompt when a capable provider's call rejects", async () => {
    walletRegistry.register(
      makeAuthEntrySigningProvider({
        signAuthEntry: async () => {
          throw new Error('wallet does not support "signAuthEntry"');
        },
      }),
    );
    useAuthenticationStore.setState({
      selectedWalletId: "test-auth-entry-signer",
    });

    const { result } = renderHook(() => useWallet());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.signAuthEntry(
          "raw-auth-entry-xdr",
          "GOPERATOR",
          TEST_NETWORK_PASSPHRASE,
        );
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      'wallet does not support "signAuthEntry"',
    );
    expect(useAuthenticationStore.getState().isWalletDisconnected).toBe(true);
  });
});

describe("useWallet - legacy connect() session", () => {
  beforeEach(() => {
    resetStore();
    mockKit = makeMockKit();
  });

  afterEach(() => {
    cleanup();
    mockKit = null;
  });

  it("stores the kit provider's registry id so the session can sign auth entries", async () => {
    class FakeKitProvider extends StellarWalletsKitProvider {
      override async connect() {
        return { address: "GKITADDRESS" };
      }
      override async signAuthEntry(authEntryXdr: string) {
        return `signed:${authEntryXdr}`;
      }
    }
    const fake = new FakeKitProvider();
    // Not walletRegistry.register(): the registry has no unregister, so a
    // registered fake would leak into every later test file in this process.
    const getAll = spyOn(walletRegistry, "getAll").mockReturnValue([fake]);
    const get = spyOn(walletRegistry, "get").mockImplementation((id: string) =>
      id === fake.id ? fake : undefined,
    );

    try {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect();
      });

      // Storing the picked module's own id (the mock kit's "freighter") would
      // not resolve in the registry, leaving the session unable to sign.
      const state = useAuthenticationStore.getState();
      expect(state.selectedWalletId).toBe("stellar-wallets-kit");
      expect(state.isConnected).toBe(true);
      expect(state.address).toBe("GKITADDRESS");
      expect(result.current.canSignAuthEntries).toBe(true);

      let signed = "";
      await act(async () => {
        signed = await result.current.signAuthEntry(
          "raw-entry",
          "GKITADDRESS",
          TEST_NETWORK_PASSPHRASE,
        );
      });
      expect(signed).toBe("signed:raw-entry");
    } finally {
      getAll.mockRestore();
      get.mockRestore();
    }
  });
});
