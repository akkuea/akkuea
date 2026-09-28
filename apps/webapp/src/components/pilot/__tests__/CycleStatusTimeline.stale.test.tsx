import "@/test/setup-dom";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import { CycleStatusTimeline } from "../CycleStatusTimeline";
import { populatedCycles, SAMPLE_NOW, timelineFor } from "../fixtures";

afterEach(() => {
  cleanup();
});

describe("CycleStatusTimeline stale-data state", () => {
  it("keeps the last good cycles and flags them stale when a refresh fails", () => {
    const view = render(
      <CycleStatusTimeline
        timeline={timelineFor(populatedCycles)}
        isLoading={false}
        error="Soroban RPC unreachable"
        lastUpdatedAt={new Date((SAMPLE_NOW - 300) * 1000)}
        connectionStatus="disconnected"
        onRefresh={() => {}}
      />,
    );
    expect(view.getByRole("status", { name: /stale/i })).not.toBeNull();
    expect(view.getByText(/Soroban RPC unreachable/)).not.toBeNull();
    // Stale data stays on screen instead of collapsing to the error card.
    expect(view.queryByRole("button", { name: /^retry$/i })).toBeNull();
  });

  it("shows no stale indicator when reads are healthy", () => {
    const view = render(
      <CycleStatusTimeline
        timeline={timelineFor(populatedCycles)}
        isLoading={false}
        error={null}
        lastUpdatedAt={new Date(SAMPLE_NOW * 1000)}
        connectionStatus="connected"
        onRefresh={() => {}}
      />,
    );
    expect(view.queryByRole("status", { name: /stale/i })).toBeNull();
  });
});
