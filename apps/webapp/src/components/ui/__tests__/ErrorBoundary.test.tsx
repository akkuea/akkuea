import "@/test/setup-dom";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import {
  setErrorTrackingProvider,
  type ErrorTrackingProvider,
} from "@akkuea/shared";
import { ErrorBoundary } from "../ErrorBoundary";

afterEach(() => {
  cleanup();
  setErrorTrackingProvider(null);
});

describe("ErrorBoundary", () => {
  it("reports caught render errors to the configured provider", () => {
    const provider: ErrorTrackingProvider = {
      captureError: mock(),
      captureMessage: mock(),
      setUser: mock(),
    };
    setErrorTrackingProvider(provider);

    const consoleErrorSpy = spyOn(console, "error").mockImplementation(
      () => {},
    );

    function Bomb(): never {
      throw new Error("boom");
    }

    const view = render(
      <ErrorBoundary fallback={<div>something went wrong</div>}>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(view.queryByText("something went wrong")).not.toBeNull();
    expect(provider.captureError).toHaveBeenCalledTimes(1);
    const call = (provider.captureError as ReturnType<typeof mock>).mock
      .calls[0];
    expect(call[0].message).toBe("boom");
    expect(call[1].context).toBe("webapp-error-boundary");

    consoleErrorSpy.mockRestore();
  });
});
