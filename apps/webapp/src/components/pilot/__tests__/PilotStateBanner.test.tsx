import "@/test/setup-dom";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import { PilotStateBanner } from "../PilotStateBanner";
import { sampleExitRecord } from "../fixtures";

// Every render in a bun test process shares one document. Without this the
// markup stays attached to the body for every file that runs afterwards.
afterEach(() => {
  cleanup();
});

describe("PilotStateBanner", () => {
  it("renders nothing while the pilot is active and unpaused", () => {
    const view = render(<PilotStateBanner />);
    expect(view.container.textContent).toBe("");
  });

  it("explains a terminal exit with its on-chain reason and timestamp", () => {
    const view = render(<PilotStateBanner exitRecord={sampleExitRecord} />);
    expect(view.queryByText(/this pilot has ended/i)).not.toBeNull();
    expect(view.queryByText(/property sold to a new owner/i)).not.toBeNull();
    expect(view.queryByText(/exited on/i)).not.toBeNull();
    // A paused banner must not appear when the contract is not paused.
    expect(view.queryByText(/payouts are paused/i)).toBeNull();
  });

  it("shows a distinct paused banner for a paused contract", () => {
    const view = render(<PilotStateBanner isPaused />);
    expect(view.queryByText(/payouts are paused/i)).not.toBeNull();
    expect(view.queryByText(/this pilot has ended/i)).toBeNull();
  });

  it("shows both when a wound-down pilot is also paused", () => {
    const view = render(
      <PilotStateBanner exitRecord={sampleExitRecord} isPaused />,
    );
    expect(view.queryByText(/this pilot has ended/i)).not.toBeNull();
    expect(view.queryByText(/payouts are paused/i)).not.toBeNull();
  });
});
