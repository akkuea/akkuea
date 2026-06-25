import { http, HttpResponse } from "msw";
import { mockAdminQueue, mockAdminPropertyDetail } from "../fixtures/admin";
import type { PaginatedResponse } from "@/services/api/types";
import type { OperationalPropertyListItem } from "@/services/api/adminOperations";

export const adminHandlers = [
  /**
   * GET /api/admin/operations/properties?queue=...
   * Admin property operations queue
   */
  http.get("/api/admin/operations/properties", ({ request }) => {
    const url = new URL(request.url);
    const queue = url.searchParams.get("queue") || "all";
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "20");

    let items = [...mockAdminQueue];

    if (queue !== "all") {
      const queueStatusMap: Record<string, string> = {
        pending: "pending_review",
        approved: "approved",
        rejected: "rejected",
        hold: "on_hold",
        changes: "changes_requested",
      };
      const mapped = queueStatusMap[queue];
      if (mapped) {
        items = items.filter((p) => p.reviewStatus === mapped);
      }
    }

    const total = items.length;
    const start = (page - 1) * limit;
    const data = items.slice(start, start + limit);

    const response: PaginatedResponse<OperationalPropertyListItem> & {
      success: boolean;
    } = {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /api/admin/operations/properties/:propertyId
   */
  http.get("/api/admin/operations/properties/:propertyId", ({ params }) => {
    if (params.propertyId === mockAdminPropertyDetail.id) {
      return HttpResponse.json({
        success: true,
        data: mockAdminPropertyDetail,
      });
    }
    return HttpResponse.json(
      { success: false, error: "Property not found in operations queue" },
      { status: 404 },
    );
  }),

  /**
   * POST /api/admin/operations/properties/:propertyId/review
   */
  http.post(
    "/api/admin/operations/properties/:propertyId/review",
    async ({ request, params }) => {
      const body = (await request.json()) as {
        action?: string;
        note?: string;
        actorWallet?: string;
      };

      const actionStatusMap: Record<string, string> = {
        approve: "approved",
        reject: "rejected",
        request_changes: "changes_requested",
        hold: "on_hold",
      };

      const updatedDetail = {
        ...mockAdminPropertyDetail,
        id: params.propertyId as string,
        reviewStatus: actionStatusMap[body.action ?? "approve"] ?? "approved",
        lastReviewedAt: new Date().toISOString(),
        lastReviewerWallet: body.actorWallet ?? null,
        lastReviewNote: body.note ?? null,
      };

      return HttpResponse.json({ success: true, data: updatedDetail });
    },
  ),
];
