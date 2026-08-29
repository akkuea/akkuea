import "@/test/setup-dom";
import { within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import { InvestorHoldingsCard } from "../InvestorHoldingsCard";
import { SAMPLE_NOW, sampleHoldings } from "../fixtures";

const baseProps = {
  totalDistributed: BigInt(21_150_0000000),
  isLoading: false,
  error: null as string | null,
  isDisconnected: false,
  lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
  connectionStatus: "connected" as const,
  onRefresh: () => {},
};

describe("InvestorHoldingsCard", () => {
  it("shows a skeleton while the first read is in flight", () => {
    const view = render(
      <InvestorHoldingsCard
        {...baseProps}
        holdings={null}
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
      <InvestorHoldingsCard
        {...baseProps}
        holdings={null}
        error="Could not reach Soroban RPC."
        lastUpdatedAt={null}
        connectionStatus="disconnected"
      />,
    );
    expect(
      within(view.container).queryByText(/could not reach soroban rpc/i),
    ).not.toBeNull();
  });

  it("shows an empty state for a wallet holding no tokens", () => {
    const view = render(
      <InvestorHoldingsCard
        {...baseProps}
        holdings={{ ...sampleHoldings, balance: BigInt(0) }}
      />,
    );
    expect(
      within(view.container).queryByText(/no holdings yet/i),
    ).not.toBeNull();
  });

  it("asks for a wallet when none is connected", () => {
    const view = render(
      <InvestorHoldingsCard
        {...baseProps}
        holdings={null}
        isDisconnected
        lastUpdatedAt={null}
        connectionStatus="disconnected"
      />,
    );
    expect(
      within(view.container).queryByText(
        /connect your wallet to see your position/i,
      ),
    ).not.toBeNull();
  });

  it("derives share of supply and the investor's cut of distributions", () => {
    const view = render(
      <InvestorHoldingsCard {...baseProps} holdings={sampleHoldings} />,
    );
    const scope = within(view.container);
    // 250 of 1,000 tokens is a quarter of the supply.
    expect(scope.queryByText("25.00%")).not.toBeNull();
    expect(scope.queryByText("5,287.50 USDC")).not.toBeNull();
    expect(scope.queryByText(/250.00 AKIN/)).not.toBeNull();
  });

  it("warns a holder who is not approved on the whitelist", () => {
    const view = render(
      <InvestorHoldingsCard
        {...baseProps}
        holdings={{ ...sampleHoldings, whitelisted: false }}
      />,
    );
    expect(
      within(view.container).queryByText(
        /not approved on the pilot whitelist/i,
      ),
    ).not.toBeNull();
  });
});
