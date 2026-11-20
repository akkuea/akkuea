import "@/test/setup-dom";
import { afterEach, describe, expect, it } from "bun:test";

const { cleanup, fireEvent, within } = await import("@testing-library/react");
const { renderWithIntl: render } = await import("@/test/renderWithIntl");
const { EvidenceVerification } = await import("../EvidenceVerification");

afterEach(() => {
  cleanup();
});

describe("EvidenceVerification", () => {
  it("never fetches and reports unreachable when evidence link is not https", async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const view = render(
        <EvidenceVerification
          evidenceLink="http://example.org/insecure.pdf"
          evidenceHashHex="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        />,
      );

      const button = within(view.container).getByRole("button", {
        name: /verify this evidence/i,
      });
      fireEvent.click(button);

      // Assert that fetch was NOT called
      expect(fetchCalled).toBe(false);

      // Assert that unreachable warning with the translated invalid link reason is shown
      const scope = within(view.container);
      expect(
        scope.queryByText(
          /the document could not be retrieved, so it was not verified/i,
        ),
      ).not.toBeNull();
      expect(
        scope.queryByText(/evidence link is not a valid https:\/\/ url/i),
      ).not.toBeNull();
      // File fallback is still accessible
      expect(scope.queryByText(/hash a downloaded file/i)).not.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
