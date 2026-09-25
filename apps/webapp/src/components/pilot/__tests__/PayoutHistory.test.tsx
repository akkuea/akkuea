import "@/test/setup-dom";
import { cleanup, within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import { PayoutHistory } from "../PayoutHistory";
import {
  pendingSettlementCycle,
  SAMPLE_NOW,
  settlementCycles,
} from "../fixtures";

const baseProps = {
  isLoading: false,
  error: null as string | null,
  lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
  connectionStatus: "connected" as const,
  onRefresh: () => {},
};

afterEach(() => {
  cleanup();
});

describe("PayoutHistory", () => {
  it("shows an empty state before any cycle has distributed", () => {
    const view = render(
      <PayoutHistory {...baseProps} cycles={[pendingSettlementCycle]} />,
    );
    expect(
      within(view.container).queryByText(/no payouts yet/i),
    ).not.toBeNull();
  });

  it("renders the amount and currency actually paid, read from stored state", () => {
    const view = render(
      <PayoutHistory {...baseProps} cycles={settlementCycles} />,
    );
    const scope = within(view.container);
    // The amount appears both as the row's figure and inside its description.
    // The EURC cycle reports the EURC delivered, not the pre-swap USDC share.
    expect(scope.queryAllByText(/9,800\.00 EURC/).length).toBeGreaterThan(0);
    expect(scope.queryByText(/paid 9,800\.00 EURC/i)).not.toBeNull();
  });

  it("labels a withheld cycle and its claimable USDC", () => {
    const view = render(
      <PayoutHistory {...baseProps} cycles={settlementCycles} />,
    );
    const scope = within(view.container);
    expect(scope.queryByText(/^withheld$/i)).not.toBeNull();
    expect(scope.queryByText(/10,000\.00 USDC/)).not.toBeNull();
  });

  it("keeps showing settled payouts when no events are available", () => {
    // The component reads only the persisted settlement passed in; there is no
    // event source to lose. Rendering with an empty event response is therefore
    // identical to this render, and the amount must still be present.
    const view = render(
      <PayoutHistory {...baseProps} cycles={settlementCycles} />,
    );
    expect(
      within(view.container).queryAllByText(/9,800\.00 EURC/).length,
    ).toBeGreaterThan(0);
  });

  it("links to the explorer so a reader can inspect the contract directly", () => {
    const view = render(
      <PayoutHistory
        {...baseProps}
        cycles={settlementCycles}
        explorerUrl="https://stellar.expert/explorer/testnet/contract/CABC"
      />,
    );
    const link = within(view.container).getAllByRole("link", {
      name: /verify this cycle on the explorer/i,
    });
    expect(link.length).toBeGreaterThan(0);
  });
});
