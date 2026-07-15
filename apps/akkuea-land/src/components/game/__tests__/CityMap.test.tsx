// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
(dom.window as any).fetch = fetch;
globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
globalThis.navigator = dom.window.navigator as any;
globalThis.HTMLElement = dom.window.HTMLElement as any;
globalThis.MutationObserver = dom.window.MutationObserver as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { beforeEach, describe, expect, it, mock } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";

mock.module("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

mock.module("../PropertyPanel", () => ({
  PropertyPanel: ({ property }: any) => (
    <aside aria-label="Selected property panel">{property.name}</aside>
  ),
}));

import { CityMap } from "../CityMap";

describe("CityMap keyboard accessibility", () => {
  beforeEach(() => {
    cleanup();
  });

  it("allows tiles to be navigated and activated entirely with the keyboard", () => {
    const view = render(<CityMap />);
    const grid = view.getByRole("grid", {
      name: "Akkuea City property grid",
    });
    const firstTile = view.getByRole("gridcell", {
      name: /Tile A1, row 1, column 1,/,
    });

    expect(firstTile.getAttribute("tabindex")).toBe("0");
    expect(firstTile.getAttribute("aria-selected")).toBe("false");
    expect(firstTile.getAttribute("aria-label")).toContain(
      "not listed for sale",
    );

    firstTile.focus();
    expect(document.activeElement).toBe(firstTile);

    fireEvent.keyDown(grid, { key: "ArrowRight" });
    const secondTile = view.getByRole("gridcell", {
      name: /Tile B1, row 1, column 2,/,
    });
    expect(document.activeElement).toBe(secondTile);
    expect(secondTile.getAttribute("tabindex")).toBe("0");
    expect(firstTile.getAttribute("tabindex")).toBe("-1");

    fireEvent.keyDown(grid, { key: "ArrowDown" });
    const lowerTile = view.getByRole("gridcell", {
      name: /Tile B2, row 2, column 2,/,
    });
    expect(document.activeElement).toBe(lowerTile);

    fireEvent.keyDown(grid, { key: "Enter" });
    expect(lowerTile.getAttribute("aria-selected")).toBe("true");
    expect(view.getByLabelText("Selected property panel")).not.toBeNull();
  });

  it("supports tab focus and space activation on a tile", () => {
    const view = render(<CityMap />);
    const grid = view.getByRole("grid", {
      name: "Akkuea City property grid",
    });
    const firstTile = view.getByRole("gridcell", {
      name: /Tile A1, row 1, column 1,/,
    });

    firstTile.focus();
    fireEvent.keyDown(grid, { key: " " });

    expect(firstTile.getAttribute("aria-selected")).toBe("true");
    expect(view.getByLabelText("Selected property panel")).not.toBeNull();
  });
});
