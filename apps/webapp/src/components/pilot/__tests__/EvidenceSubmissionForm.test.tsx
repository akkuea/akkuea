import "@/test/setup-dom";

// Testing Library (and with it react-dom) is loaded only after setup-dom has
// installed `window` and DOM globals.
const { cleanup, fireEvent, within } = await import("@testing-library/react");
const { renderWithIntl: render } = await import("@/test/renderWithIntl");
const { EvidenceSubmissionFormView } =
  await import("../EvidenceSubmissionForm");
type EvidenceSubmissionWallet =
  import("../EvidenceSubmissionForm").EvidenceSubmissionWallet;

const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

const connectedWallet: EvidenceSubmissionWallet = {
  address: ALLY,
  isConnected: true,
  connect: () => {},
  signTransaction: async (xdr: string) => xdr,
};

const disconnectedWallet: EvidenceSubmissionWallet = {
  ...connectedWallet,
  address: null,
  isConnected: false,
};

/**
 * The file input is looked up by attribute rather than by label text or an id
 * selector. Both of those resolve through per-document indexes that jsdom does
 * not keep in sync once a `bun test` run spans several files, so they return
 * nothing for a node that is demonstrably in the container. The label
 * association itself is asserted separately.
 */
function fileInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>('input[id="evidence-file"]');
}

function renderForm(props: Record<string, unknown> = {}) {
  return render(
    <EvidenceSubmissionFormView
      cycleId="2026-03"
      wallet={connectedWallet}
      {...props}
    />,
  );
}

// Every render in a bun test process shares one document. Without this the
// markup stays attached to the body for every file that runs afterwards, and
// a body-scoped query in one of them matches this file's leftovers.
afterEach(() => {
  cleanup();
});

describe("EvidenceSubmissionForm", () => {
  it("asks for a wallet when none is connected", () => {
    const view = renderForm({ wallet: disconnectedWallet });
    const scope = within(view.container);
    expect(
      scope.queryByText(/connect your wallet to submit evidence/i),
    ).not.toBeNull();
    expect(fileInput(view.container)).toBeNull();
  });

  it("names the cycle being reported and explains the hashing", () => {
    const view = renderForm();
    const scope = within(view.container);
    const label = view.container.querySelector('label[for="evidence-file"]');
    expect(label?.textContent).toMatch(/income statement/i);
    expect(scope.queryByText(/evidence for march 2026/i)).not.toBeNull();
    expect(
      scope.queryByText(/only its sha-256 hash is written/i),
    ).not.toBeNull();
  });

  it("keeps submit disabled until a file, link, and amount are present", () => {
    const view = renderForm();
    const submit = within(view.container).getByRole("button", {
      name: /submit for review/i,
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("locks a cycle that is already approved on-chain", () => {
    const view = renderForm({ currentStatus: "approved" });
    const scope = within(view.container);
    expect(scope.queryByText(/already recorded on-chain/i)).not.toBeNull();
    expect(fileInput(view.container)?.disabled).toBe(true);
  });

  it("shows the operator's reason and reopens the form after a rejection", () => {
    const view = renderForm({
      currentStatus: "rejected",
      reviewReason: "The statement covers three weeks, not the full month.",
    });
    const scope = within(view.container);
    expect(scope.queryByText(/covers three weeks/i)).not.toBeNull();
    expect(scope.queryByText(/already recorded on-chain/i)).toBeNull();
    expect(fileInput(view.container)?.disabled).toBe(false);
  });

  it("disables submission while the contract is paused", () => {
    const view = renderForm({ isPaused: true });
    const scope = within(view.container);
    expect(scope.queryByText(/payout contract is paused/i)).not.toBeNull();
    expect(fileInput(view.container)?.disabled).toBe(true);
  });

  it("rejects http, javascript, data, relative path, and strings with spaces", () => {
    const view = renderForm();
    const scope = within(view.container);
    const linkInput = view.container.querySelector(
      'input[placeholder="https://"]',
    ) as HTMLInputElement;
    expect(linkInput).not.toBeNull();

    const invalidLinks = [
      "http://example.com/statement.pdf",
      "javascript:alert('xss')",
      "data:text/html;base64,PHNjcmlwdD4=",
      "/statements/2026-08.pdf",
      "https://example.com/my statement.pdf",
      "   ",
    ];

    for (const invalid of invalidLinks) {
      fireEvent.change(linkInput, { target: { value: invalid } });
      expect(
        scope.queryByText(/evidence link must be a valid https:\/\/ url/i),
      ).not.toBeNull();
      const submit = scope.getByRole("button", { name: /submit for review/i });
      expect((submit as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("accepts a valid https URL without displaying validation error", () => {
    const view = renderForm();
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
