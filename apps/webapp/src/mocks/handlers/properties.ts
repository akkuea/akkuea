import { http, HttpResponse } from "msw";
import {
  mockPaginatedProperties,
  mockProperties,
} from "../fixtures/properties";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const propertyHandlers = [
  /**
   * GET /properties - list all properties with optional filters & pagination
   */
  http.get(`${API_BASE}/properties`, ({ request }) => {
    const url = new URL(request.url);
    const propertyType = url.searchParams.get("propertyType");
    const country = url.searchParams.get("country");
    const verified = url.searchParams.get("verified");
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "10");

    let filtered = [...mockProperties];

    if (propertyType) {
      filtered = filtered.filter((p) => p.propertyType === propertyType);
    }
    if (country) {
      filtered = filtered.filter(
        (p) => p.location.country.toLowerCase() === country.toLowerCase(),
      );
    }
    if (verified !== null) {
      filtered = filtered.filter((p) => p.verified === (verified === "true"));
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return HttpResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  /**
   * GET /properties/:id - get single property
   */
  http.get(`${API_BASE}/properties/:id`, ({ params }) => {
    const property = mockProperties.find((p) => p.id === params.id);
    if (!property) {
      return HttpResponse.json(
        { code: "PROPERTY_NOT_FOUND", message: "Property not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json(property);
  }),

  /**
   * POST /properties - create new property (admin)
   */
  http.post(`${API_BASE}/properties`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newProperty = {
      id: crypto.randomUUID(),
      ...(body as object),
      verified: false,
      listedAt: new Date().toISOString(),
      documents: [],
      availableShares: (body?.totalShares as number) ?? 10000,
      tokenAddress: undefined,
    };
    return HttpResponse.json(newProperty, { status: 201 });
  }),

  /**
   * POST /properties/:id/tokenize
   */
  http.post(`${API_BASE}/properties/:id/tokenize`, ({ params }) => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const property = mockProperties.find((p) => p.id === id);
    if (!property) {
      return HttpResponse.json(
        { code: "PROPERTY_NOT_FOUND", message: "Property not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      tokenAddress:
        "GBTOKENMOCK" + (id ?? "").replace(/-/g, "").slice(0, 34).toUpperCase(),
      transactionHash:
        "mock_tx_hash_" + Math.random().toString(36).substring(2, 18),
    });
  }),

  /**
   * POST /properties/:id/buy-shares
   */
  http.post(`${API_BASE}/properties/:id/buy-shares`, async ({ request }) => {
    const body = (await request.json()) as { shares?: number };
    return HttpResponse.json({
      transactionHash:
        "mock_tx_buy_" + Math.random().toString(36).substring(2, 18),
      newBalance: body.shares ?? 0,
    });
  }),

  /**
   * GET /properties/:propertyId/shares/:ownerAddress
   */
  http.get(
    `${API_BASE}/properties/:propertyId/shares/:ownerAddress`,
    ({ params }) => {
      // Return mock share ownership for any request
      return HttpResponse.json({
        propertyId: params.propertyId,
        owner: params.ownerAddress,
        shares: 150,
        purchasePrice: "12750.00",
        purchasedAt: "2024-04-02T11:15:00.000Z",
        lastDividendClaimed: "2024-09-01T00:00:00.000Z",
      });
    },
  ),
];

// Re-export for convenience
export { mockPaginatedProperties, mockProperties };
