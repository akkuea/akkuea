import "@/test/setup-dom";
import { cleanup, within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import { RecordEvidenceCosignPanel } from "../RecordEvidenceCosignPanel";

afterEach(() => {
  cleanup();
});

const defaultProps = {
  operatorAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  allyAddress: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
  signTransaction: async (xdr: string) => xdr,
};

describe("RecordEvidenceCosignPanel", () => {
  it("rejects non-https URLs with a validation error", () => {
    const view = render(
      <RecordEvidenceCosignPanel
        {...defaultProps}
        initialEvidenceLink="http://insecure.org/statement.pdf"
      />,
    );
    const scope = within(view.container);
    expect(
      scope.queryByText(/must be a valid https:\/\/ url/i),
    ).not.toBeNull();
    const prepareBtn = scope.getByRole("button", {
      name: /prepare distribution/i,
    });
    expect((prepareBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not show an error message for a valid https URL", () => {
    const view = render(
      <RecordEvidenceCosignPanel
        {...defaultProps}
        initialEvidenceLink="https://example.org/statement.pdf"
      />,
    );
    const scope = within(view.container);
    expect(scope.queryByText(/must be a valid https:\/\/ url/i)).toBeNull();
  });
});
