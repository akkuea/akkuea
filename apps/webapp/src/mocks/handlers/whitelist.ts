import { http, HttpResponse } from "msw";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const mockRequests = [
  {
    id: "req-001",
    walletAddress: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
    fullName: "Maria Santos",
    idType: "passport",
    idReference: "P-84721934",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: "req-002",
    walletAddress: "GDNSSYSCSSGH6LKCQC345PNKRTSV6U2I6ZQJWVP7BFVMXFNKZAQOMHB",
    fullName: "Carlos Ramírez",
    idType: "national_id",
    idReference: "NI-20948302",
    status: "pending",
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

/**
 * MSW handlers for the pilot whitelist API routes.
 * Used in Storybook stories and browser-based tests.
 */
export const whitelistHandlers = [
  http.get(`${API_BASE}/pilot/whitelist/pending`, () =>
    HttpResponse.json({ success: true, data: mockRequests }),
  ),

  http.get(
    `${API_BASE}/pilot/whitelist/status/:walletAddress`,
    ({ params }) => {
      const addr = params.walletAddress as string;
      if (addr === "APPROVED_WALLET") {
        return HttpResponse.json({ success: true, status: "approved" });
      }
      if (addr === "PENDING_WALLET") {
        return HttpResponse.json({ success: true, status: "pending" });
      }
      if (addr === "REJECTED_WALLET") {
        return HttpResponse.json({
          success: true,
          status: "rejected",
          rejectionReason:
            "Unable to verify the provided ID reference against available records.",
        });
      }
      return HttpResponse.json({ success: true, status: "none" });
    },
  ),

  http.post(`${API_BASE}/pilot/whitelist/request`, () =>
    HttpResponse.json({
      success: true,
      data: { id: "new-req", status: "pending" },
    }),
  ),

  http.post(`${API_BASE}/pilot/whitelist/:id/review`, () =>
    HttpResponse.json({ success: true, txHash: "mock_tx_hash_abc123def456" }),
  ),
];
