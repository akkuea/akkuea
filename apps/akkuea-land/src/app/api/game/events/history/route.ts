import { NextRequest, NextResponse } from "next/server";
import { queryHistory } from "@/lib/event-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function GET(req: NextRequest): NextResponse {
  const { searchParams } = req.nextUrl;

  const player = searchParams.get("player") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(1, limitParam), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const result = queryHistory({ player, limit, cursor });

  return NextResponse.json(result);
}
