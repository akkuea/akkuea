import "@/test/setup-dom";
import { cleanup, within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import {
  EvidenceReviewQueueView,
  type OperatorWallet,
} from "../EvidenceReviewQueue";
import {
  awaitingReviewCycle,
  paidOnTimeCycle,
  populatedCycles,
  SAMPLE_NOW,
} from "../fixtures";

const disconnectedWallet: OperatorWallet = {
  address: null,
  isConnected: false,
  connect: () => {},
  signTransaction: async (xdr: string) => xdr,
};

const baseProps = {
  wallet: disconnectedWallet,
  isLoading: false,
  error: null as string | null,
  lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
  connectionStatus: "connected" as const,
  onRefresh: () => {},
};

// Every render in a bun test process shares one document. Without this the
// markup stays attached to the body for every file that runs afterwards, and
// a body-scoped query in one of them matches this file's leftovers.
afterEach(() => {
  cleanup();
});

describe("EvidenceReviewQueue", () => {
  it("shows a skeleton while the first read is in flight", () => {
    const view = render(
      <EvidenceReviewQueueView
        {...baseProps}
        cycles={[]}
        isLoading
        lastUpdatedAt={null}
        connectionStatus="connecting"
      />,
    );
    expect(
      within(view.container).queryByLabelText(/loading text/i),
    ).not.toBeNull();
  });

  it("shows the error message when nothing has loaded", () => {
    const view = render(
      <EvidenceReviewQueueView
        {...baseProps}
        cycles={[]}
        error="Could not reach Soroban RPC."
        lastUpdatedAt={null}
        connectionStatus="disconnected"
      />,
    );
    expect(
      within(view.container).queryByText(/could not reach soroban rpc/i),
    ).not.toBeNull();
  });

  it("shows an empty queue once every reported cycle is settled", () => {
    const view = render(
      <EvidenceReviewQueueView {...baseProps} cycles={[paidOnTimeCycle]} />,
    );
    expect(
      within(view.container).queryByText(/nothing waiting on review/i),
    ).not.toBeNull();
  });

  it("lists a submitted cycle with its reported income and link", () => {
    const view = render(
      <EvidenceReviewQueueView {...baseProps} cycles={populatedCycles} />,
    );
    const scope = within(view.container);
    expect(scope.queryByText(/march 2026/i)).not.toBeNull();
    expect(scope.queryByText(/reported 12,400.00 usdc/i)).not.toBeNull();
    expect(scope.queryByText(/check it against the hash/i)).not.toBeNull();
  });

  it("excludes already distributed cycles from the queue", () => {
    const view = render(
      <EvidenceReviewQueueView {...baseProps} cycles={[paidOnTimeCycle]} />,
    );
    expect(within(view.container).queryByText(/january 2026/i)).toBeNull();
  });

  it("prompts for a wallet before any review action", () => {
    const view = render(
      <EvidenceReviewQueueView {...baseProps} cycles={[awaitingReviewCycle]} />,
    );
    expect(
      within(view.container).queryByText(/connect the operator wallet/i),
    ).not.toBeNull();
  });

  it("disables review actions while the contract is paused", () => {
    const view = render(
      <EvidenceReviewQueueView
        {...baseProps}
        cycles={[awaitingReviewCycle]}
        isPaused
      />,
    );
    const scope = within(view.container);
    expect(scope.queryByText(/payout contract is paused/i)).not.toBeNull();
    const approve = scope.getByRole("button", { name: /approve/i });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps reject disabled until a reason is given", () => {
    const view = render(
      <EvidenceReviewQueueView {...baseProps} cycles={[awaitingReviewCycle]} />,
    );
    const reject = within(view.container).getByRole("button", {
      name: /reject/i,
    });
    expect((reject as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders a valid https evidence link as an openable anchor", () => {
    const view = render(
      <EvidenceReviewQueueView {...baseProps} cycles={populatedCycles} />,
    );
    const link = view.container.querySelector(
      'a[href="https://example.org/statements/2026-03.pdf"]',
    );
    expect(link).not.toBeNull();
  });

  it("renders an invalid stored evidence link as plain text warning and never as an anchor", () => {
    const invalidCycles = [
      {
        ...awaitingReviewCycle,
        cycleId: "2026-04",
        evidenceLink: "http://insecure.org/statement.pdf",
      },
      {
        ...awaitingReviewCycle,
        cycleId: "2026-05",
        evidenceLink: "javascript:alert(1)",
      },
      {
        ...awaitingReviewCycle,
        cycleId: "2026-06",
        evidenceLink: "data:text/plain;base64,123",
      },
      {
        ...awaitingReviewCycle,
        cycleId: "2026-07",
        evidenceLink: "/relative/statement.pdf",
      },
    ];
    const view = render(
      <EvidenceReviewQueueView {...baseProps} cycles={invalidCycles} />,
    );
    // Invalid links must never become anchors
    expect(view.container.querySelector('a[href^="http://"]')).toBeNull();
    expect(view.container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(view.container.querySelector('a[href^="data:"]')).toBeNull();
    expect(view.container.querySelector('a[href^="/relative"]')).toBeNull();

    // Plain text and warnings should be displayed
    const scope = within(view.container);
    expect(
      scope.queryByText("http://insecure.org/statement.pdf"),
    ).not.toBeNull();
    expect(scope.queryByText("javascript:alert(1)")).not.toBeNull();
    expect(
      scope.queryByText("data:text/plain;base64,123"),
    ).not.toBeNull();
    expect(
      scope.queryByText("/relative/statement.pdf"),
    ).not.toBeNull();
    expect(scope.queryAllByText(/not a valid https url/i).length).toBe(4);
  });
});
