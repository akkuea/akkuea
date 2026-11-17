import "@/test/setup-dom";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import { EvidenceVerification } from "../EvidenceVerification";

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Buffer.from(new Uint8Array(digest)).toString("hex");
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
});

describe("EvidenceVerification", () => {
  it("fetches and verifies a valid https evidence link", async () => {
    const content = "March 2026 statement";
    const expectedHex = await sha256Hex(content);
    let requestedUrl = "";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(new TextEncoder().encode(content), { status: 200 });
    }) as unknown as typeof fetch;

    const view = render(
      <EvidenceVerification
        evidenceLink="https://example.org/statements/2026-03.pdf"
        evidenceHashHex={expectedHex}
      />,
    );
    const scope = within(view.container);

    fireEvent.click(
      scope.getByRole("button", { name: /verify this evidence/i }),
    );

    await waitFor(() => {
      expect(
        scope.queryByText(/matches the hash recorded on-chain/i),
      ).not.toBeNull();
    });
    expect(requestedUrl).toBe("https://example.org/statements/2026-03.pdf");
  });

  it("never fetches a stored link that is not https and keeps local file hashing available", async () => {
    const content = "March 2026 statement";
    const expectedHex = await sha256Hex(content);
    let fetchCalled = false;

    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("unexpected", { status: 200 });
    }) as unknown as typeof fetch;

    const view = render(
      <EvidenceVerification
        evidenceLink="http://example.org/statements/2026-03.pdf"
        evidenceHashHex={expectedHex}
      />,
    );
    const scope = within(view.container);

    expect(
      scope.queryByRole("button", { name: /verify this evidence/i }),
    ).toBeNull();
    expect(
      scope.queryByText(/automatic verification requires an https:\/\/ url/i),
    ).not.toBeNull();
    expect(fetchCalled).toBe(false);

    const fileInput =
      view.container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [
          new File([new TextEncoder().encode(content)], "march.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(
        scope.queryByText(/matches the hash recorded on-chain/i),
      ).not.toBeNull();
    });
    expect(fetchCalled).toBe(false);
  });
});
