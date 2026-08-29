import "@/test/setup-dom";
import { within } from "@testing-library/react";
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
});
