import "@/test/setup-dom";
import { afterEach, describe, expect, it } from "bun:test";

const { cleanup, fireEvent, within } = await import("@testing-library/react");
const { renderWithIntl: render } = await import("@/test/renderWithIntl");
const { RecordEvidenceCosignPanel } =
  await import("../RecordEvidenceCosignPanel");

const OPERATOR = "GBZXN7PIRZGNMHGA728RGRFZAPPWN9G8LYHQ7R8BA53G5Z8K9M8N7O6P";
const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

const baseProps = {
  operatorAddress: OPERATOR,
  allyAddress: ALLY,
  signTransaction: async (xdr: string) => xdr,
};

afterEach(() => {
  cleanup();
});

describe("RecordEvidenceCosignPanel", () => {
  it("rejects non-https URLs and strings with spaces with a translated validation error", () => {
    const view = render(<RecordEvidenceCosignPanel {...baseProps} />);
    const scope = within(view.container);
    const linkInput = view.container.querySelector(
      'input[placeholder="https://"]',
    ) as HTMLInputElement;
    expect(linkInput).not.toBeNull();

    const invalidLinks = [
      "http://example.com/statement.pdf",
      "javascript:alert(1)",
      "data:text/plain;base64,abc",
      "/statements/2026-08.pdf",
      "https://example.com/my statement.pdf",
      "   ",
    ];

    for (const invalid of invalidLinks) {
      fireEvent.change(linkInput, { target: { value: invalid } });
      expect(
        scope.queryByText(/evidence link must be a valid https:\/\/ url/i),
      ).not.toBeNull();
      const prepareBtn = scope.getByRole("button", {
        name: /prepare distribution/i,
      });
      expect((prepareBtn as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("accepts a valid https URL without displaying validation error", () => {
    const view = render(<RecordEvidenceCosignPanel {...baseProps} />);
    const scope = within(view.container);
    const linkInput = view.container.querySelector(
      'input[placeholder="https://"]',
    ) as HTMLInputElement;

    fireEvent.change(linkInput, {
      target: { value: "https://example.org/statements/2026-08.pdf" },
    });
    expect(
      scope.queryByText(/evidence link must be a valid https:\/\/ url/i),
    ).toBeNull();
  });
});
