import { http, HttpResponse } from "msw";
import {
  mockPaginatedTransactions,
  mockTransactions,
} from "../fixtures/transactions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const transactionHandlers = [
  /**
   * GET /transactions - paginated transaction list with optional cursor & filters
   */
  http.get(`${API_BASE}/transactions`, ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const asset = url.searchParams.get("asset");
    const limit = Number(url.searchParams.get("limit") || "20");

    let items = [...mockTransactions];

    if (type) {
      items = items.filter((t) => t.type === type);
    }
    if (status) {
      items = items.filter((t) => t.status === status);
    }
    if (asset) {
      items = items.filter(
        (t) => t.asset.toLowerCase() === asset.toLowerCase(),
      );
    }

    items = items.slice(0, limit);

    return HttpResponse.json({
      items,
      nextCursor: undefined,
      total: items.length,
    });
  }),

  /**
   * GET /transactions/:id - single transaction by ID
   */
  http.get(`${API_BASE}/transactions/:id`, ({ params }) => {
    const tx = mockTransactions.find((t) => t.id === params.id);
    if (!tx) {
      return HttpResponse.json(
        { code: "TX_NOT_FOUND", message: "Transaction not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json(tx);
  }),
];

// Re-export for convenience
export { mockPaginatedTransactions, mockTransactions };
