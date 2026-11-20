import { describe, expect, it } from "bun:test";
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
