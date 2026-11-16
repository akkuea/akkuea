import type { Meta, StoryObj, Decorator } from "@storybook/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import esMessages from "../../../messages/es.json";
import {
  WhitelistOnboardingForm,
  WhitelistOnboardingFormView,
  type WhitelistOnboardingWallet,
} from "./WhitelistOnboardingForm";

// ---------------------------------------------------------------------------
// Fetch & locale mock helpers
// ---------------------------------------------------------------------------
type FetchMock = (input: RequestInfo | URL) => Promise<Response>;

const CONNECTED_WALLET: WhitelistOnboardingWallet = {
  address: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
  isConnected: true,
  connect: () => undefined,
};

const DISCONNECTED_WALLET: WhitelistOnboardingWallet = {
  address: null,
  isConnected: false,
  connect: () => undefined,
};

const spanishMessages = esMessages as unknown as AbstractIntlMessages;

const withSpanishLocale: Decorator = (Story) => (
  <NextIntlClientProvider locale="es" messages={spanishMessages} timeZone="UTC">
    <Story />
  </NextIntlClientProvider>
);

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
 * Wallet not connected and no existing request, shows the EmptyState with
 * a "Start Application" CTA.
 */
export const NoApplication: Story = {
  render: () => <WhitelistOnboardingFormView wallet={DISCONNECTED_WALLET} />,
  decorators: [mockFetch(statusMock("none"))],
};

/**
 * Loading state, status check is in flight.
 */
export const StatusLoading: Story = {
  render: () => <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
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
  render: () => <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
  decorators: [mockFetch(statusMock("pending"))],
};

/**
 * Investor has been approved and whitelisted.
 */
export const Approved: Story = {
  render: () => <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
  decorators: [mockFetch(statusMock("approved"))],
};

/**
 * Investor was rejected, rejection reason is displayed clearly.
 */
export const Rejected: Story = {
  render: () => <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
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
 * Stepper step 1, Personal Details form (initial active state).
 * The status fetch returns "none" so the form renders after clicking Start.
 * NOTE: In Storybook, click "Start Application" on the EmptyState to reach this view.
 */
export const FormStep1PersonalDetails: Story = {
  name: "Form, Step 1: Personal Details",
  render: () => <WhitelistOnboardingFormView wallet={DISCONNECTED_WALLET} />,
  decorators: [mockFetch(statusMock("none"))],
};

/**
 * Stepper step 3, Review & Submit summary.
 * The fetch mock simulates a completed form: status=none so the form renders,
 * and the POST /request is mocked to succeed.
 */
export const FormStep3Review: Story = {
  name: "Form, Step 3: Review & Submit",
  render: () => <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
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

/**
 * Spanish locale: Empty onboarding state.
 */
export const NoApplicationEs: Story = {
  name: "Spanish (es): No Application",
  render: () => <WhitelistOnboardingFormView wallet={DISCONNECTED_WALLET} />,
  decorators: [withSpanishLocale, mockFetch(statusMock("none"))],
};

/**
 * Spanish locale: Pending review state.
 */
export const PendingReviewEs: Story = {
  name: "Spanish (es): Pending Review",
  render: () => <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
  decorators: [withSpanishLocale, mockFetch(statusMock("pending"))],
};

/**
 * Spanish locale: Approved state.
 */
export const ApprovedEs: Story = {
  name: "Spanish (es): Approved",
  render: () => <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
  decorators: [withSpanishLocale, mockFetch(statusMock("approved"))],
};

/**
 * Spanish locale: Rejected state.
 */
export const RejectedEs: Story = {
  name: "Spanish (es): Rejected",
  render: () => <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
  decorators: [
    withSpanishLocale,
    mockFetch(
      statusMock(
        "rejected",
        "No fue posible verificar el documento proporcionado.",
      ),
    ),
  ],
};
