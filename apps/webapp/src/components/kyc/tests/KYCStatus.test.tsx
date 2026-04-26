import "@/test/setup-dom";
import { render } from "@testing-library/react";
import KYCStatus from "../KYCStatus";

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
