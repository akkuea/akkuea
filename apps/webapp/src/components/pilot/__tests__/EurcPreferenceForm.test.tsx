import "@/test/setup-dom";
import { cleanup, fireEvent, within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import {
  EurcPreferenceFormView,
  type SettlementWallet,
} from "../EurcPreferenceForm";

const connectedWallet: SettlementWallet = {
  address: "GDMNDPKKZQGCXQVJFVNQZ3Q5VJQ5F4VJ3XJ4W6O2F3Q5H7K4L2M4N6P8R",
  isConnected: true,
  connect: () => {},
  signTransaction: async (xdr: string) => xdr,
};

const disconnectedWallet: SettlementWallet = {
  ...connectedWallet,
  address: null,
  isConnected: false,
};

afterEach(() => {
  cleanup();
});

describe("EurcPreferenceFormView", () => {
  it("prompts for a wallet before any preference change", () => {
    const view = render(
      <EurcPreferenceFormView
        currentPreference="usdc"
        wallet={disconnectedWallet}
      />,
    );
    expect(
      within(view.container).queryByText(/connect your wallet to change/i),
    ).not.toBeNull();
  });

  it("shows the preference currently stored on-chain", () => {
    const view = render(
      <EurcPreferenceFormView
        currentPreference="eurc"
        wallet={connectedWallet}
      />,
    );
    expect(within(view.container).queryByText(/paid in eurc/i)).not.toBeNull();
  });

  it("drives opting into EURC: risk is disclosed and saving becomes possible", () => {
    const view = render(
      <EurcPreferenceFormView
        currentPreference="usdc"
        wallet={connectedWallet}
      />,
    );
    const scope = within(view.container);

    // Nothing to change yet, so the control starts disabled and the risk of
    // the EURC path is not yet shown.
    const save = scope.getByRole("button", { name: /save preference/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(scope.queryByText(/pool cannot meet the minimum rate/i)).toBeNull();

    // Opting in reveals the swap and price-floor risk before the signature.
    fireEvent.click(scope.getByRole("switch"));
    expect(
      scope.queryByText(/pool cannot meet the minimum rate/i),
    ).not.toBeNull();
    expect((save as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables the control while the payout contract is paused", () => {
    const view = render(
      <EurcPreferenceFormView
        currentPreference="usdc"
        isPaused
        wallet={connectedWallet}
      />,
    );
    const scope = within(view.container);
    expect(scope.queryByText(/currency changes are disabled/i)).not.toBeNull();
    expect((scope.getByRole("switch") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
