import { describe, expect, it } from "bun:test";
import { getPilotLinks, isNavItemActive } from "./Navbar";
import enMessages from "../../../messages/en.json";
import esMessages from "../../../messages/es.json";

describe("Navbar pilot navigation labels", () => {
  it("en.json contains all four pilot nav keys under Navbar", () => {
    expect(enMessages.Navbar).toBeDefined();
    expect(enMessages.Navbar.pilotInvestor).toBe("Investor");
    expect(enMessages.Navbar.pilotOnboarding).toBe("Join Pilot");
    expect(enMessages.Navbar.pilotAlly).toBe("Ally");
    expect(enMessages.Navbar.pilotReview).toBe("Review");
  });

  it("es.json contains all four pilot nav keys under Navbar", () => {
    expect(esMessages.Navbar).toBeDefined();
    expect(esMessages.Navbar.pilotInvestor).toBe("Inversor");
    expect(esMessages.Navbar.pilotOnboarding).toBe("Unirse al Piloto");
    expect(esMessages.Navbar.pilotAlly).toBe("Aliado");
    expect(esMessages.Navbar.pilotReview).toBe("Revisi\u00f3n");
  });

  it("en.json preserves existing Navbar keys", () => {
    expect(enMessages.Navbar.dashboard).toBe("Dashboard");
    expect(enMessages.Navbar.marketplace).toBe("Marketplace");
    expect(enMessages.Navbar.tokenize).toBe("Tokenize");
    expect(enMessages.Navbar.lending).toBe("Lending");
  });

  it("es.json preserves existing Navbar keys", () => {
    expect(esMessages.Navbar.dashboard).toBe("Panel");
    expect(esMessages.Navbar.marketplace).toBe("Mercado");
    expect(esMessages.Navbar.tokenize).toBe("Tokenizar");
    expect(esMessages.Navbar.lending).toBe("Pr\u00e9stamos");
  });
});

describe("getPilotLinks", () => {
  it("returns investor and onboarding links when operator is not configured", () => {
    const links = getPilotLinks(false);
    expect(links.map((l) => l.href)).toEqual([
      "/pilot/investor",
      "/pilot/onboarding",
    ]);
  });

  it("includes ally and review links when operator is configured", () => {
    const links = getPilotLinks(true);
    expect(links.map((l) => l.href)).toEqual([
      "/pilot/investor",
      "/pilot/onboarding",
      "/pilot/ally",
      "/pilot/review/whitelist",
    ]);
  });

  it("always returns investor and onboarding as the first two links", () => {
    const linksWithOp = getPilotLinks(true);
    expect(linksWithOp[0].href).toBe("/pilot/investor");
    expect(linksWithOp[1].href).toBe("/pilot/onboarding");
  });

  it("returns link keys that match Navbar message keys", () => {
    const allKeys = getPilotLinks(true).map((l) => l.key);
    for (const key of allKeys) {
      expect(enMessages.Navbar).toHaveProperty(key);
    }
  });
});

describe("isNavItemActive", () => {
  it("returns true for exact pathname match", () => {
    expect(isNavItemActive("/pilot/investor", "/pilot/investor")).toBe(true);
  });

  it("returns true for a child route", () => {
    expect(isNavItemActive("/pilot/review/whitelist", "/pilot/review/whitelist")).toBe(true);
    expect(isNavItemActive("/pilot/review/whitelist/details", "/pilot/review/whitelist")).toBe(true);
  });

  it("returns false for an unrelated route", () => {
    expect(isNavItemActive("/marketplace", "/pilot/investor")).toBe(false);
  });

  it("does not match a path that starts with the href string but not as a segment", () => {
    // /pilot/investors should NOT match /pilot/investor
    expect(isNavItemActive("/pilot/investors", "/pilot/investor")).toBe(false);
  });
});
