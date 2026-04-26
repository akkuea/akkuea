import { NextRequest, NextResponse } from "next/server";

/** Shared secret with the API for the internal operations routes (set in deployment env). */
const operationsBackendCredential =
  process.env.OPERATIONS_BACKEND_CREDENTIAL ?? "";
const API_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

function parseAllowlist(): string[] | "wildcard" {
  const raw = process.env.OPERATIONS_ALLOWED_WALLETS ?? "";
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.includes("*")) return "wildcard";
  return parts;
}

function isOperatorAllowed(wallet: string | null): boolean {
  const mode = parseAllowlist();
  if (mode === "wildcard") {
    return Boolean(wallet && wallet.length >= 50);
  }
  if (mode.length === 0) {
    return false;
  }
  return Boolean(wallet && mode.includes(wallet));
}

async function proxy(
  req: NextRequest,
  segments: string[],
  method: string,
): Promise<NextResponse> {
  if (!operationsBackendCredential) {
    return NextResponse.json(
      {
        success: false,
        error: "NOT_CONFIGURED",
        message: "Operations API is not configured on this deployment",
      },
      { status: 503 },
    );
  }

  const wallet = req.headers.get("x-operator-wallet");
  if (!isOperatorAllowed(wallet)) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN",
        message: "You are not authorized to access operations tools",
      },
      { status: 403 },
    );
  }

  const path = segments.join("/");
  const targetUrl = new URL(`${API_BASE}/internal/operations/${path}`);
  const incomingUrl = new URL(req.url);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers();
  headers.set("x-internal-api-key", operationsBackendCredential);
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    const body = await req.text();
    if (body) init.body = body;
  }

  const res = await fetch(targetUrl.toString(), init);
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
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
