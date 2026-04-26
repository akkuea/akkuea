import type { PropertyInfo, ValuationRecord } from "@real-estate-defi/shared";
import type { PaginatedResponse } from "./types";

export type OperationsQueue =
  | "pending"
  | "approved"
  | "rejected"
  | "hold"
  | "changes"
  | "all";

export type PropertyReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "on_hold";

export type ReviewAction = "approve" | "reject" | "request_changes" | "hold";

export interface OperationalPropertyListItem {
  id: string;
  name: string;
  propertyType: string;
  city: string;
  country: string;
  reviewStatus: PropertyReviewStatus;
  verified: boolean;
  ownerWallet: string;
  ownerKycStatus: string;
  ownerKycTier: string;
  tokenized: boolean;
  sorobanPropertyId: number | null;
  valuationState: string;
  documentCount: number;
  readiness: {
    kycApproved: boolean;
    valuationActive: boolean;
    hasTokenAddress: boolean;
  };
  lastReviewedAt: string | null;
  lastReviewerWallet: string | null;
  lastReviewNote: string | null;
  listedAt: string;
}

export interface OperationalPropertyDetail extends PropertyInfo {
  reviewStatus: PropertyReviewStatus;
  lastReviewedAt: string | null;
  lastReviewerWallet: string | null;
  lastReviewNote: string | null;
  ownerKycStatus: string;
  ownerKycTier: string;
  valuation: {
    state: string;
    record?: ValuationRecord;
  };
  audit: {
    lastActionAt: string | null;
    lastActorWallet: string | null;
    lastNote: string | null;
  };
}

async function adminFetch<T>(
  path: string,
  operatorWallet: string | null,
  init?: RequestInit,
): Promise<T> {
  const url = `/api/admin/operations/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(operatorWallet ? { "x-operator-wallet": operatorWallet } : {}),
    },
  });

  const json = (await res.json()) as T & {
    success?: boolean;
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      json.message ?? res.statusText ?? "Operations request failed",
    );
  }

  return json as T;
}

export const adminOperationsApi = {
  async listQueue(
    operatorWallet: string | null,
    params: { queue: OperationsQueue; page?: number; limit?: number },
  ): Promise<
    PaginatedResponse<OperationalPropertyListItem> & { success: boolean }
  > {
    const search = new URLSearchParams();
    search.set("queue", params.queue);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    return adminFetch(`properties?${search.toString()}`, operatorWallet);
  },

  async getProperty(
    operatorWallet: string | null,
    propertyId: string,
  ): Promise<{ success: boolean; data: OperationalPropertyDetail }> {
    return adminFetch(`properties/${propertyId}`, operatorWallet);
  },

  async reviewProperty(
    operatorWallet: string | null,
    propertyId: string,
    body: { action: ReviewAction; note?: string; actorWallet: string },
  ): Promise<{ success: boolean; data: OperationalPropertyDetail }> {
    return adminFetch(`properties/${propertyId}/review`, operatorWallet, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
