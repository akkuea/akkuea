import type { Meta, StoryObj, Decorator } from "@storybook/react";
import { WhitelistReviewQueue } from "./WhitelistReviewQueue";

// ---------------------------------------------------------------------------
// Fetch mock helpers — avoids needing msw-storybook-addon
// ---------------------------------------------------------------------------
type FetchMock = (input: RequestInfo | URL) => Promise<Response>;

function mockFetch(handler: FetchMock): Decorator {
  return (Story) => {
    const original = globalThis.fetch;
    globalThis.fetch = handler as typeof fetch;
    const result = Story();
    // Restore after render (story cleanup)
    setTimeout(() => {
      globalThis.fetch = original;
    }, 0);
    return result;
  };
}

const mockRequest1 = {
  id: "req-001",
  walletAddress: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
  fullName: "Maria Santos",
  idType: "passport",
  idReference: "P-84721934",
  status: "pending",
  createdAt: new Date().toISOString(),
};

const mockRequest2 = {
  id: "req-002",
  walletAddress: "GDNSSYSCSSGH6LKCQC345PNKRTSV6U2I6ZQJWVP7BFVMXFNKZAQOMHB",
  fullName: "Carlos Ramírez",
  idType: "national_id",
  idReference: "NI-20948302",
  status: "pending",
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------
const meta: Meta<typeof WhitelistReviewQueue> = {
  title: "Pilot/WhitelistReviewQueue",
  component: WhitelistReviewQueue,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-4xl mx-auto bg-zinc-950 min-h-[600px] p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WhitelistReviewQueue>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Two pending requests in the queue — the typical operator view. */
export const WithRequests: Story = {
  decorators: [
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: [mockRequest1, mockRequest2] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  ],
};

/** No pending requests — shows the EmptyState component. */
export const EmptyQueue: Story = {
  decorators: [
    mockFetch(
      async () =>
        new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  ],
};

/** API fetch is slow — shows the loading spinner text. */
export const LoadingState: Story = {
  decorators: [
    mockFetch(
      () =>
        new Promise(() => {
          /* intentionally never resolves */
        }),
    ),
  ],
};

/** API returns an error — shows SectionErrorFallback with a Retry button. */
export const ErrorState: Story = {
  decorators: [
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({ message: "Forbidden: admin access required" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
    ),
  ],
};
