import type { Meta, StoryObj, Decorator } from "@storybook/react";
import { WhitelistOnboardingForm } from "./WhitelistOnboardingForm";

// ---------------------------------------------------------------------------
// Fetch mock helper
// ---------------------------------------------------------------------------
type FetchMock = (input: RequestInfo | URL) => Promise<Response>;

function mockFetch(handler: FetchMock): Decorator {
  return (Story) => {
    const original = globalThis.fetch;
    globalThis.fetch = handler as typeof fetch;
    const result = Story();
    setTimeout(() => {
      globalThis.fetch = original;
    }, 0);
    return result;
  };
}

/** Returns a status-endpoint mock for a given status value */
function statusMock(status: string, rejectionReason?: string): FetchMock {
  return async () =>
    new Response(JSON.stringify({ success: true, status, rejectionReason }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------
const meta: Meta<typeof WhitelistOnboardingForm> = {
  title: "Pilot/WhitelistOnboardingForm",
  component: WhitelistOnboardingForm,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl bg-zinc-950 p-8 flex items-center justify-center min-h-[600px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WhitelistOnboardingForm>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Wallet not connected and no existing request — shows the EmptyState with
 * a "Start Application" CTA.
 */
export const NoApplication: Story = {
  decorators: [mockFetch(statusMock("none"))],
};

/**
 * Loading state — status check is in flight.
 */
export const StatusLoading: Story = {
  decorators: [
    mockFetch(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    ),
  ],
};

/**
 * Request is under review by the operator.
 */
export const PendingReview: Story = {
  decorators: [mockFetch(statusMock("pending"))],
};

/**
 * Investor has been approved — whitelisted!
 */
export const Approved: Story = {
  decorators: [mockFetch(statusMock("approved"))],
};

/**
 * Investor was rejected — rejection reason is displayed clearly.
 */
export const Rejected: Story = {
  decorators: [
    mockFetch(
      statusMock(
        "rejected",
        "Unable to verify the provided ID reference against available records. Please re-apply with a valid document number.",
      ),
    ),
  ],
};

/**
 * Stepper step 1 — Personal Details form (initial active state).
 * The status fetch returns "none" so the form renders after clicking Start.
 * NOTE: In Storybook, click "Start Application" on the EmptyState to reach this view.
 */
export const FormStep1PersonalDetails: Story = {
  name: "Form — Step 1: Personal Details",
  decorators: [mockFetch(statusMock("none"))],
};

/**
 * Stepper step 3 — Review & Submit summary.
 * The fetch mock simulates a completed form: status=none so the form renders,
 * and the POST /request is mocked to succeed.
 */
export const FormStep3Review: Story = {
  name: "Form — Step 3: Review & Submit",
  decorators: [
    mockFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/request")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { id: "new-req", status: "pending" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ success: true, status: "none" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  ],
};
