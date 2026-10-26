import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

type VerifiedUser = { walletAddress?: unknown };

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ success: false, error, message }, { status });
}

function isAllowedOperator(wallet: string): boolean {
  const allowed = (process.env.OPERATIONS_ALLOWED_WALLETS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.includes("*")) {
    const developmentWildcard =
      process.env.NODE_ENV !== "production" &&
      process.env.OPERATIONS_ALLOW_WILDCARD_IN_DEVELOPMENT === "true";
    return developmentWildcard && /^G[A-Z2-7]{55}$/.test(wallet);
  }
  return allowed.includes(wallet);
}

function validPath(segments: string[], rawPathname: string): boolean {
  if (/%2f|%5c/i.test(rawPathname) || segments.length === 0) return false;
  return segments.every((segment) => /^[A-Za-z0-9_-]+$/.test(segment));
}

async function verifySession(authorization: string): Promise<string | null> {
  try {
    const profileUrl = `${API_BASE.replace(/\/+$/, "")}/users/me`;
    const response = await fetch(profileUrl, {
      method: "GET",
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const user = (await response.json()) as VerifiedUser;
    return typeof user.walletAddress === "string" ? user.walletAddress : null;
  } catch {
    return null;
  }
}

async function proxy(
  req: NextRequest,
  segments: string[],
  method: string,
): Promise<NextResponse> {
  const operationsBackendCredential =
    process.env.OPERATIONS_BACKEND_CREDENTIAL ?? "";
  const rawPathname = new URL(req.url).pathname;
  if (!validPath(segments, rawPathname)) {
    return jsonError(400, "BAD_REQUEST", "Invalid operations path");
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "A valid API session is required");
  }
  const wallet = await verifySession(authorization);
  if (!wallet) {
    return jsonError(401, "UNAUTHORIZED", "A valid API session is required");
  }
  if (!isAllowedOperator(wallet)) {
    return jsonError(
      403,
      "FORBIDDEN",
      "You are not authorized to access operations tools",
    );
  }
  if (!operationsBackendCredential) {
    return jsonError(503, "NOT_CONFIGURED", "Operations API is not configured");
  }

  const base = new URL(API_BASE);
  const basePath = `${base.pathname.replace(/\/+$/, "")}/internal/operations/`;
  const targetUrl = new URL(base);
  targetUrl.pathname = `${basePath}${segments.join("/")}`;
  targetUrl.search = new URL(req.url).search;
  if (!targetUrl.pathname.startsWith(basePath)) {
    return jsonError(400, "BAD_REQUEST", "Invalid operations path");
  }

  const headers = new Headers({
    "x-internal-api-key": operationsBackendCredential,
    "x-operator-wallet": wallet,
  });
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    const body = await req.text();
    if (body) init.body = body;
  }

  const response = await fetch(targetUrl.toString(), init);
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path, "GET");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path, "POST");
}
