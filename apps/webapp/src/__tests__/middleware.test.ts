import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { sanitizeCallbackUrl } from "../lib/sanitizeCallbackUrl";

const ORIGIN = "https://app.example.com";

function redirectFor(path: string) {
  const response = middleware(new NextRequest(`${ORIGIN}${path}`));
  const location = response.headers.get("location");
  return { response, location };
}

describe("middleware callbackUrl", () => {
  it("sends an unauthenticated protected deep link to login with the path intact", () => {
    const { response, location } = redirectFor("/en/marketplace/1?tab=x");

    expect(response.status).toBe(307);
    expect(location).toBeTruthy();

    const loginUrl = new URL(location as string);
    expect(loginUrl.pathname).toBe("/en/login");

    // The value must be encoded exactly once: reading it back has to give the
    // original path, not a %2F-prefixed string.
    const callbackUrl = loginUrl.searchParams.get("callbackUrl");
    expect(callbackUrl).toBe("/en/marketplace/1?tab=x");

    // And it must survive the sanitizer the login page applies, unchanged.
    expect(sanitizeCallbackUrl(callbackUrl, ORIGIN)).toBe(
      "/en/marketplace/1?tab=x",
    );
  });

  it("keeps the locale prefix of the protected path in the callback", () => {
    const { location } = redirectFor("/es/dashboard");

    const loginUrl = new URL(location as string);
    expect(loginUrl.pathname).toBe("/es/login");
    expect(loginUrl.searchParams.get("callbackUrl")).toBe("/es/dashboard");
  });

  it("does not treat /map as a protected route", () => {
    const { location } = redirectFor("/en/map");

    expect(location ?? "").not.toContain("/login");
  });

  it("still redirects /marketplace, which stays protected", () => {
    const { location } = redirectFor("/en/marketplace");

    expect(new URL(location as string).pathname).toBe("/en/login");
  });
});
