import type { PropertyInfo, ShareOwnership } from "@akkuea/shared";
import { apiClient } from "./client";
import type { PaginatedResponse, PaginationParams } from "./types";

/**
 * Property creation payload
 */
export interface CreatePropertyPayload {
  name: string;
  description: string;
  propertyType: string;
  location: {
    address: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  totalValue: string;
  totalShares: number;
  pricePerShare: string;
  images: string[];
}

/**
 * Unsigned `purchase_shares` transaction returned by buy-shares/prepare
 */
export interface PrepareBuySharesResponse {
  xdr: string;
  contractId: string;
  sorobanPropertyId: string;
  shares: number;
  paymentToken: string;
  totalAmount: string;
}

/**
 * Property filter options
 */
export interface PropertyFilters {
  propertyType?: string;
  country?: string;
  minPrice?: number;
  maxPrice?: number;
  verified?: boolean;
}

/**
 * Property API service
 */
export const propertyApi = {
  /**
   * Get all properties with pagination
   */
  async getAll(
    params?: PaginationParams & PropertyFilters,
  ): Promise<PaginatedResponse<PropertyInfo>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const path = `/properties${query ? `?${query}` : ""}`;
    const response = await apiClient.get<PaginatedResponse<PropertyInfo>>(path);
    return response.data;
  },

  /**
   * Get property by ID
   */
  async getById(id: string): Promise<PropertyInfo> {
    const response = await apiClient.get<PropertyInfo>(`/properties/${id}`);
    return response.data;
  },

  /**
   * Create new property
   */
  async create(payload: CreatePropertyPayload): Promise<PropertyInfo> {
    const response = await apiClient.post<PropertyInfo>("/properties", payload);
    return response.data;
  },

  /**
   * Tokenize property
   */
  async tokenize(
    id: string,
  ): Promise<{ tokenAddress: string; transactionHash: string }> {
    const response = await apiClient.post<{
      tokenAddress: string;
      transactionHash: string;
    }>(`/properties/${id}/tokenize`);
    return response.data;
  },

  /**
   * Step 1 of buying shares: get an unsigned `purchase_shares` transaction
   * (buyer as source) to sign with the connected wallet and submit.
   */
  async prepareBuyShares(
    id: string,
    buyer: string,
    shares: number,
  ): Promise<PrepareBuySharesResponse> {
    const response = await apiClient.post<PrepareBuySharesResponse>(
      `/properties/${id}/buy-shares/prepare`,
      { buyer, shares },
      {
        headers: {
          "x-user-address": buyer,
        },
      },
    );
    return response.data;
  },

  /**
   * Step 2 of buying shares: have the API verify a submitted transaction
   * on-chain and record the purchase. Confirming the same hash twice returns
   * the same result without counting the purchase again.
   */
  async confirmBuyShares(
    id: string,
    txHash: string,
    buyer: string,
  ): Promise<{ transactionHash: string; newBalance: number }> {
    const response = await apiClient.post<{
      transactionHash: string;
      newBalance: number;
    }>(
      `/properties/${id}/buy-shares/confirm`,
      { txHash },
      {
        headers: {
          "x-user-address": buyer,
        },
      },
    );
    return response.data;
  },

  /**
   * Get user's share holdings for a property
   */
  async getShares(
    propertyId: string,
    ownerAddress: string,
  ): Promise<ShareOwnership | null> {
    const response = await apiClient.get<ShareOwnership | null>(
      `/properties/${propertyId}/shares/${ownerAddress}`,
    );
    return response.data;
  },
};
