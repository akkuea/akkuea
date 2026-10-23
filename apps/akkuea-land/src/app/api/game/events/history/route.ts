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
  const limitRaw = searchParams.get("limit");
  const limitParam =
    limitRaw === null ? DEFAULT_LIMIT : Number(limitRaw);
  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const result = queryHistory({ player, limit, cursor });

  return NextResponse.json(result);
}
