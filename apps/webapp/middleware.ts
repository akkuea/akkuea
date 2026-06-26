import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "akkuea-authenticated";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAuthCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value === "1";

  if (hasAuthCookie) {
    return NextResponse.next();
  }

  const callbackUrl = encodeURIComponent(`${pathname}${search}`);
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("callbackUrl", callbackUrl);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/marketplace",
    "/marketplace/:path*",
    "/map",
    "/map/:path*",
  ],
};
