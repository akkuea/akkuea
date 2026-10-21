import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";
import { buildContentSecurityPolicy } from "./src/lib/csp";

const intlMiddleware = createMiddleware(routing);

const AUTH_COOKIE_NAME = "akkuea-authenticated";
const PROTECTED_ROUTES = ["/dashboard", "/marketplace"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`) ||
      routing.locales.some(
        (locale) =>
          pathname === `/${locale}${route}` ||
          pathname.startsWith(`/${locale}${route}/`),
      ),
  );

  if (isProtected) {
    const hasAuthCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value === "1";
    if (!hasAuthCookie) {
      // searchParams.set() encodes the value once; encoding it here too
      // produced %252F... and the login page could not resolve the path.
      const callbackUrl = `${pathname}${search}`;
      const loginUrl = request.nextUrl.clone();

      const localeMatch = pathname.match(
        new RegExp(`^/(${routing.locales.join("|")})(/|$)`),
      );
      const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";

      loginUrl.pathname = `${localePrefix}/login`;
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Generate a CSP nonce for inline script protection.
  // Uses crypto.randomUUID() and encodes as base64 per OWASP recommendations.
  const nonceBuffer = new Uint8Array(16);
  crypto.getRandomValues(nonceBuffer);
  const nonce = Buffer.from(nonceBuffer).toString("base64");

  // Build CSP with nonce and set it on the request so Next.js can stamp it on inline scripts.
  const cspValue = buildContentSecurityPolicy(nonce);
  const cspHeaderName = process.env.CSP_REPORT_ONLY === "true"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  // Set nonce on request headers so Next.js middleware can access it
  request.headers.set("x-nonce", nonce);
  request.headers.set(cspHeaderName, cspValue);

  const response = intlMiddleware(request);

  // Forward CSP header to response
  response.headers.set(cspHeaderName, cspValue);

  return response;
}

export const config = {
  matcher: ["/", "/(es|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
