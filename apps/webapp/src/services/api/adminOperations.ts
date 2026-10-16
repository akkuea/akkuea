import type { PropertyInfo, ValuationRecord } from "@akkuea/shared";
import type { PaginatedResponse } from "./types";

export type OperationsQueue =
  "pending" | "approved" | "rejected" | "hold" | "changes" | "all";

export type PropertyReviewStatus =
  "pending_review" | "approved" | "rejected" | "changes_requested" | "on_hold";

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
  init?: RequestInit,
): Promise<T> {
  const url = `/api/admin/operations/${path.replace(/^\//, "")}`;
  const sessionToken = getStoredSessionToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
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

export function getStoredSessionToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem("auth_token");
}

export const adminOperationsApi = {
  async listQueue(
    params: { queue: OperationsQueue; page?: number; limit?: number },
  ): Promise<
    PaginatedResponse<OperationalPropertyListItem> & { success: boolean }
  > {
    const search = new URLSearchParams();
    search.set("queue", params.queue);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    return adminFetch(`properties?${search.toString()}`);
  },

  async getProperty(
    propertyId: string,
  ): Promise<{ success: boolean; data: OperationalPropertyDetail }> {
    return adminFetch(`properties/${propertyId}`);
  },

  async reviewProperty(
    propertyId: string,
    body: { action: ReviewAction; note?: string },
  ): Promise<{ success: boolean; data: OperationalPropertyDetail }> {
    return adminFetch(`properties/${propertyId}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export interface WhitelistRequest {
  id: string;
  walletAddress: string;
  fullName: string;
  idType: string;
  idReference: string;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export const whitelistOperationsApi = {
  async getPendingWhitelist(
  ): Promise<{ success: boolean; data: WhitelistRequest[] }> {
    return adminFetch(`pilot/whitelist/pending`);
  },

  async reviewWhitelistRequest(
    requestId: string,
    body: { action: "approve" | "reject"; reason?: string },
  ): Promise<{ success: boolean; txHash?: string }> {
    return adminFetch(`pilot/whitelist/${requestId}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
