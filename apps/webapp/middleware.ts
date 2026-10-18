import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const AUTH_COOKIE_NAME = "akkuea-authenticated";
const PROTECTED_ROUTES = ["/dashboard", "/marketplace", "/map"];

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
      const callbackUrl = encodeURIComponent(`${pathname}${search}`);
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

  const response = intlMiddleware(request);

  // Inject a CSP nonce for inline script protection.
  // The nonce is passed to next.config.ts headers() via x-nonce request header,
  // then included in the Content-Security-Policy script-src directive.
  // This allows Next.js hydration and component inline scripts without 'unsafe-inline'.
  // Use crypto.getRandomValues() which is available in Edge Runtime.
  const nonceBuffer = new Uint8Array(16);
  crypto.getRandomValues(nonceBuffer);
  const nonce = Array.from(nonceBuffer, (b) => b.toString(16).padStart(2, "0")).join("");
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: ["/", "/(es|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
