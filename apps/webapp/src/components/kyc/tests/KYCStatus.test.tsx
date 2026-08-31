import "@/test/setup-dom";
import { cleanup, render } from "@testing-library/react";
import KYCStatus from "../KYCStatus";

// Every render in a bun test process shares one document. Without this the
// markup stays attached to the body for every file that runs afterwards, and
// a body-scoped query in one of them matches this file's leftovers.
afterEach(() => {
  cleanup();
});

describe("KYCStatus", () => {
  it("displays pending status", () => {
    const view = render(<KYCStatus status="pending" />);
    expect(view.queryByText(/Verification Pending/i)).not.toBeNull();
  });

  it("displays approved status", () => {
    const view = render(<KYCStatus status="approved" />);
    expect(view.queryByText(/KYC Approved/i)).not.toBeNull();
  });

  it("displays rejected status", () => {
    const view = render(<KYCStatus status="rejected" />);
    expect(view.queryByText(/KYC Rejected/i)).not.toBeNull();
  });
});
