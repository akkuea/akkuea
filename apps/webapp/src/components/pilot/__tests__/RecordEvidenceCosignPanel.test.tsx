await import("@/test/setup-dom");
const { cleanup, fireEvent, waitFor, within } =
  await import("@testing-library/react");
const { renderWithIntl: render } = await import("@/test/renderWithIntl");
const { RecordEvidenceCosignPanel } =
  await import("../RecordEvidenceCosignPanel");

const OPERATOR = "GOPERATOR23456789012345678901234567890123456789012345678";
const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

afterEach(() => {
  cleanup();
});

describe("RecordEvidenceCosignPanel", () => {
  it("shows a translated validation error for invalid links and enables prepare for a valid https URL", async () => {
    const view = render(
      <RecordEvidenceCosignPanel
        operatorAddress={OPERATOR}
        allyAddress={ALLY}
        signTransaction={async (xdr: string) => xdr}
      />,
    );
    const scope = within(view.container);

    const cycleInput = scope.getByPlaceholderText(
      "2026-09",
    ) as HTMLInputElement;
    fireEvent.change(cycleInput, { target: { value: "2026-03" } });

    const upload = view.container.querySelector<HTMLInputElement>(
      'input[id="record-evidence-file"]',
    );
    expect(upload).not.toBeNull();
    fireEvent.change(upload as HTMLInputElement, {
      target: {
        files: [
          new File([new TextEncoder().encode("statement")], "march.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(view.container.textContent).toContain("...");
    });

    const amountInput = view.container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    expect(amountInput).not.toBeNull();
    fireEvent.change(amountInput as HTMLInputElement, {
      target: { value: "900" },
    });

    const linkInput = scope.getByPlaceholderText(
      "https://",
    ) as HTMLInputElement;
    const prepareButton = scope.getByRole("button", {
      name: /prepare distribution/i,
    }) as HTMLButtonElement;

    for (const invalid of [
      "http://example.org/doc.pdf",
      "javascript:alert(1)",
      "data:text/plain,abc",
      "statements/doc.pdf",
      "https://example.org/my doc.pdf",
    ]) {
      fireEvent.change(linkInput, { target: { value: invalid } });
      expect(prepareButton.disabled).toBe(true);
      expect(linkInput.getAttribute("aria-invalid")).toBe("true");
      expect(
        scope.queryByText(/enter a complete https:\/\/ url with no spaces/i),
      ).not.toBeNull();
    }

    fireEvent.change(linkInput, {
      target: { value: "https://example.org/statements/2026-03.pdf" },
    });
    expect(linkInput.getAttribute("aria-invalid")).toBeNull();
    expect(prepareButton.disabled).toBe(false);
  });
});
