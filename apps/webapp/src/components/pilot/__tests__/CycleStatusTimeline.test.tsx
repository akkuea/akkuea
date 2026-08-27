import "@/test/setup-dom";
import { within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/renderWithIntl";
import { CycleStatusTimeline } from "../CycleStatusTimeline";
import {
  escalatedCycles,
  populatedCycles,
  SAMPLE_NOW,
  timelineFor,
} from "../fixtures";

const baseProps = {
  isLoading: false,
  error: null as string | null,
  lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
  connectionStatus: "connected" as const,
  onRefresh: () => {},
};

describe("CycleStatusTimeline", () => {
  it("shows a skeleton while the first read is in flight", () => {
    const view = render(
      <CycleStatusTimeline
        {...baseProps}
        timeline={timelineFor([])}
        isLoading
        lastUpdatedAt={null}
        connectionStatus="connecting"
      />,
    );
    expect(view.queryByLabelText(/loading text/i)).not.toBeNull();
  });

  it("shows the error message when nothing has loaded", () => {
    const view = render(
      <CycleStatusTimeline
        {...baseProps}
        timeline={timelineFor([])}
        error="Could not reach Soroban RPC."
        lastUpdatedAt={null}
        connectionStatus="disconnected"
      />,
    );
    expect(view.queryByText(/could not reach soroban rpc/i)).not.toBeNull();
  });

  it("shows an empty state before the pilot's first cycle", () => {
    const view = render(
      <CycleStatusTimeline {...baseProps} timeline={timelineFor([])} />,
    );
    expect(view.queryByText(/no cycles yet/i)).not.toBeNull();
  });

  it("renders each cycle with its derived status", () => {
    const view = render(
      <CycleStatusTimeline
        {...baseProps}
        timeline={timelineFor(populatedCycles)}
      />,
    );
    expect(view.queryByText("On time")).not.toBeNull();
    expect(view.queryByText("Late")).not.toBeNull();
    // The month appears in both the Stepper and the detail row.
    expect(view.queryAllByText(/january 2026/i).length).toBeGreaterThan(0);
  });

  it("keeps the loaded history visible when a later poll fails", () => {
    const view = render(
      <CycleStatusTimeline
        {...baseProps}
        timeline={timelineFor(populatedCycles)}
        error="Could not reach Soroban RPC."
        connectionStatus="disconnected"
      />,
    );
    // The month appears in both the Stepper and the detail row.
    expect(view.queryAllByText(/january 2026/i).length).toBeGreaterThan(0);
    expect(view.queryByText(/last reading that succeeded/i)).not.toBeNull();
  });

  it("announces the two-cycle escalation when the ally stops reporting", () => {
    const view = render(
      <CycleStatusTimeline
        {...baseProps}
        timeline={timelineFor(escalatedCycles)}
      />,
    );
    expect(
      view.queryByText(/has not reported for 2 consecutive cycles/i),
    ).not.toBeNull();
  });

  it("does not escalate while the ally is still paying", () => {
    const view = render(
      <CycleStatusTimeline
        {...baseProps}
        timeline={timelineFor(populatedCycles)}
      />,
    );
    // Scoped to this render's own container: a leftover node from an earlier
    // test in the same run would otherwise make the negative assertion lie.
    expect(
      within(view.container).queryByText(/consecutive cycles/i),
    ).toBeNull();
  });
});
