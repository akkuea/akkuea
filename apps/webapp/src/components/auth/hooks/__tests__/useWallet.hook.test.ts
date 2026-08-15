import "@/test/setup-dom";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";

interface MockWalletOption {
  id: string;
}

interface MockKit {
  openModal: (opts: {
    onWalletSelected: (option: MockWalletOption) => Promise<void> | void;
    onClosed: () => void;
  }) => Promise<void>;
  setWallet: (id: string) => void;
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

const { useWallet } = await import("../useWallet.hook");
const { useAuthenticationStore } =
  await import("../../store/data/slices/authentication.slice");

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
    setWallet: () => {},
    getAddress: async () => ({ address: "GADDRESSRECONNECTED" }),
    getNetwork: async () => ({ networkPassphrase: TEST_NETWORK_PASSPHRASE }),
    openModal: async (opts) => {
      opts.onClosed();
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
      openModal: async (opts) => {
        await opts.onWalletSelected({ id: "freighter" });
      },
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
      openModal: async (opts) => {
        await opts.onWalletSelected({ id: "freighter" });
      },
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
      openModal: async (opts) => {
        // Selection succeeds but the address lookup fails, forcing the
        // onWalletSelected catch branch (store.resetSession()).
        await opts.onWalletSelected({ id: "freighter" });
      },
      getAddress: async () => {
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
