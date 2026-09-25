import "@/test/setup-dom";
import { cleanup, within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import {
  WithheldFundsCardView,
  type WithheldWallet,
} from "../WithheldFundsCard";

const connectedWallet: WithheldWallet = {
  address: "GDMNDPKKZQGCXQVJFVNQZ3Q5VJQ5F4VJ3XJ4W6O2F3Q5H7K4L2M4N6P8R",
  isConnected: true,
  connect: () => {},
  signTransaction: async (xdr: string) => xdr,
};

const disconnectedWallet: WithheldWallet = {
  ...connectedWallet,
  address: null,
  isConnected: false,
};

afterEach(() => {
  cleanup();
});

describe("WithheldFundsCardView", () => {
  it("stays hidden when nothing is reserved", () => {
    const view = render(
      <WithheldFundsCardView withheld={BigInt(0)} wallet={connectedWallet} />,
    );
    expect(view.container.textContent).toBe("");
  });

  it("shows the reserved amount and a one-click claim", () => {
    const view = render(
      <WithheldFundsCardView
        withheld={BigInt(4_500_0000000)}
        wallet={connectedWallet}
      />,
    );
    const scope = within(view.container);
    expect(scope.queryByText(/4,500\.00 USDC/)).not.toBeNull();
    expect(
      scope.getByRole("button", { name: /claim in usdc/i }),
    ).not.toBeNull();
  });

  it("names the amount when prompting for a wallet", () => {
    const view = render(
      <WithheldFundsCardView
        withheld={BigInt(4_500_0000000)}
        wallet={disconnectedWallet}
      />,
    );
    const scope = within(view.container);
    expect(scope.queryByText(/connect your wallet to claim/i)).not.toBeNull();
    expect(scope.queryByText(/4,500\.00 USDC/)).not.toBeNull();
  });
});
