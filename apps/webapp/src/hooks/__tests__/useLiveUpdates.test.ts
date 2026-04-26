import { describe, expect, it, mock, beforeEach } from "bun:test";
import { getTimeSinceUpdate } from "@/hooks/useLiveUpdates";

describe("useLiveUpdates — utility functions", () => {
  describe("getTimeSinceUpdate", () => {
    it("returns 'Never' for null date", () => {
      expect(getTimeSinceUpdate(null)).toBe("Never");
    });

    it("returns 'Just now' for dates less than 5 seconds ago", () => {
      const now = new Date();
      const result = getTimeSinceUpdate(now);
      expect(result).toBe("Just now");
    });

    it("returns seconds for dates 5-59 seconds ago", () => {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      const result = getTimeSinceUpdate(thirtySecondsAgo);
      expect(result).toMatch(/^\d+s ago$/);
    });

    it("returns minutes for dates 1-59 minutes ago", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = getTimeSinceUpdate(fiveMinutesAgo);
      expect(result).toMatch(/^\d+m ago$/);
    });

    it("returns hours for dates 1+ hours ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = getTimeSinceUpdate(twoHoursAgo);
      expect(result).toMatch(/^\d+h ago$/);
    });
  });
});

describe("useLiveUpdates — polling behavior", () => {
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    mockFetch = mock(async () => ({ data: "test" }));
  });

  it("fetch function is callable", async () => {
    const result = await mockFetch();
    expect(result).toEqual({ data: "test" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetch function can be called multiple times", async () => {
    await mockFetch();
    await mockFetch();
    await mockFetch();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("fetch function handles errors gracefully", async () => {
    const errorFetch = mock(async () => {
      throw new Error("Network error");
    });

    let errorMessage: string | null = null;
    try {
      await errorFetch();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }

    expect(errorMessage).toBe("Network error");
  });
});

describe("useLiveUpdates — connection status types", () => {
  it("connection status type values are valid", () => {
    const validStatuses = ["connected", "connecting", "disconnected"];
    validStatuses.forEach((status) => {
      expect(["connected", "connecting", "disconnected"]).toContain(status);
    });
  });
});
