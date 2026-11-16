await import("@/test/setup-dom");
const { afterEach, describe, expect, it } = await import("bun:test");
const { cleanup, fireEvent, waitFor, within } =
  await import("@testing-library/react");
const { renderWithIntl: render } = await import("@/test/renderWithIntl");
const { EvidenceSubmissionFormView } =
  await import("../EvidenceSubmissionForm");
type EvidenceSubmissionWallet =
  import("../EvidenceSubmissionForm").EvidenceSubmissionWallet;
const { RecordEvidenceCosignPanel } =
  await import("../RecordEvidenceCosignPanel");

const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";
const OPERATOR = "GDTNXRLOJD2YEBPKK7KCMR7J33AAG5VZXHAJTHIG736D6LVEFLLLKPDL";

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

  it("rejects http://, javascript:, data:, relative paths, and spaces, and enables submit for valid https://", async () => {
    const view = renderForm();
    const scope = within(view.container);
    const upload = fileInput(view.container)!;
    const linkField = view.container.querySelector<HTMLInputElement>(
      'input[placeholder="https://"]',
    )!;
    const amountField = view.container.querySelector<HTMLInputElement>(
      'input[placeholder="0.00"]',
    )!;
    const submit = scope.getByRole("button", {
      name: /submit for review/i,
    }) as HTMLButtonElement;

    const sampleFile = new File(["march statement"], "2026-03.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(upload, { target: { files: [sampleFile] } });
    fireEvent.change(amountField, { target: { value: "1250.00" } });

    await waitFor(() => {
      expect(view.container.textContent).toMatch(/[0-9a-f]{4,}/i);
    });

    const invalidCases = [
      "http://example.org/statements/2026-03.pdf",
      "javascript:alert(1)",
      "data:text/plain;base64,SGVsbG8=",
      "/statements/2026-03.pdf",
      "https://example.org/statements/2026 03.pdf",
    ];

    for (const badLink of invalidCases) {
      fireEvent.change(linkField, { target: { value: badLink } });
      expect(submit.disabled).toBe(true);
      expect(
        scope.queryByText(/enter a valid https:\/\/ url with no spaces/i),
      ).not.toBeNull();
    }

    fireEvent.change(linkField, {
      target: { value: "https://example.org/statements/2026-03.pdf" },
    });
    expect(
      scope.queryByText(/enter a valid https:\/\/ url with no spaces/i),
    ).toBeNull();
    expect(submit.disabled).toBe(false);
  });
});

describe("RecordEvidenceCosignPanel link validation", () => {
  it("rejects non-https and space-containing links and enables prepare for valid https://", async () => {
    const view = render(
      <RecordEvidenceCosignPanel
        operatorAddress={OPERATOR}
        allyAddress={ALLY}
        signTransaction={async (xdr: string) => xdr}
      />,
    );
    const scope = within(view.container);
    const cycleField = view.container.querySelector<HTMLInputElement>(
      'input[placeholder="2026-09"]',
    )!;
    const upload = view.container.querySelector<HTMLInputElement>(
      'input[id="record-evidence-file"]',
    )!;
    const linkField = view.container.querySelector<HTMLInputElement>(
      'input[placeholder="https://"]',
    )!;
    const amountField = view.container.querySelector<HTMLInputElement>(
      'input[placeholder="0.00"]',
    )!;
    const prepareBtn = scope.getByRole("button", {
      name: /prepare/i,
    }) as HTMLButtonElement;

    fireEvent.change(cycleField, { target: { value: "2026-09" } });
    fireEvent.change(upload, {
      target: {
        files: [
          new File(["september statement"], "2026-09.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    fireEvent.change(amountField, { target: { value: "900.00" } });

    await waitFor(() => {
      expect(view.container.textContent).toMatch(/[0-9a-f]{4,}/i);
    });

    for (const badLink of [
      "http://example.org/2026-09.pdf",
      "javascript:alert(1)",
      "data:text/plain;base64,SGVsbG8=",
      "statements/2026-09.pdf",
      "https://example.org/2026 09.pdf",
    ]) {
      fireEvent.change(linkField, { target: { value: badLink } });
      expect(prepareBtn.disabled).toBe(true);
      expect(
        scope.queryByText(/enter a valid https:\/\/ url with no spaces/i),
      ).not.toBeNull();
    }

    fireEvent.change(linkField, {
      target: { value: "https://example.org/statements/2026-09.pdf" },
    });
    expect(
      scope.queryByText(/enter a valid https:\/\/ url with no spaces/i),
    ).toBeNull();
    expect(prepareBtn.disabled).toBe(false);
  });
});
