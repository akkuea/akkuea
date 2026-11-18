import { describe, expect, it, beforeEach, afterEach, vi } from "bun:test";
import React, { useEffect, useState } from "react";
import fs from "fs";
import path from "path";

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    setTimeout(() => {
      if (!this.closed && this.onopen) {
        this.readyState = 1;
        this.onopen();
      }
    }, 10);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }
}

describe("Dashboard and GameEventStream consolidation (#1340)", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource as any;
  });

  afterEach(() => {
    delete (globalThis as any).EventSource;
  });

  it("verifies no react-hooks/exhaustive-deps suppression remains in dashboard page", () => {
    const dashboardPagePath = path.resolve(
      __dirname,
      "../[locale]/dashboard/page.tsx",
    );
    const content = fs.readFileSync(dashboardPagePath, "utf-8");
    expect(content.includes("react-hooks/exhaustive-deps")).toBe(false);
  });

  it("verifies dashboard page does not open its own EventSource", () => {
    const dashboardPagePath = path.resolve(
      __dirname,
      "../[locale]/dashboard/page.tsx",
    );
    const content = fs.readFileSync(dashboardPagePath, "utf-8");
    expect(content.includes("new EventSource")).toBe(false);
    expect(content.includes("SSE_ENDPOINT")).toBe(false);
    expect(content.includes("useGameEvents")).toBe(true);
  });

  it("verifies layout wraps GameEventProvider as the shared event source", () => {
    const layoutPath = path.resolve(__dirname, "../[locale]/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content.includes("GameEventProvider")).toBe(true);
  });

  it("verifies GameEventContext provides currentLedger and fallback polling", () => {
    const contextPath = path.resolve(
      __dirname,
      "../../context/GameEventContext.tsx",
    );
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content.includes("currentLedger: number")).toBe(true);
    expect(content.includes("fetchLatestLedger")).toBe(true);
    expect(content.includes("startPolling")).toBe(true);
    expect(content.includes("stopPolling")).toBe(true);
  });
});
