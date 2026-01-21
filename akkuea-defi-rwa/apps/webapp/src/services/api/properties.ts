import type { PropertyInfo, ShareOwnership } from '@real-estate-defi/shared';
import { apiClient } from './client';
import type { PaginatedResponse, PaginationParams } from './types';

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
    params?: PaginationParams & PropertyFilters
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
    const path = `/properties${query ? `?${query}` : ''}`;
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
    const response = await apiClient.post<PropertyInfo>('/properties', payload);
    return response.data;
  },

  /**
   * Tokenize property
   */
  async tokenize(id: string): Promise<{ tokenAddress: string; transactionHash: string }> {
    const response = await apiClient.post<{ tokenAddress: string; transactionHash: string }>(
      `/properties/${id}/tokenize`
    );
    return response.data;
  },

  /**
   * Buy property shares
   */
  async buyShares(
    id: string,
    shares: number
  ): Promise<{ transactionHash: string; newBalance: number }> {
    const response = await apiClient.post<{ transactionHash: string; newBalance: number }>(
      `/properties/${id}/buy-shares`,
      { shares }
    );
    return response.data;
  },

  /**
   * Get user's share holdings for a property
   */
  async getShares(propertyId: string, ownerAddress: string): Promise<ShareOwnership | null> {
    const response = await apiClient.get<ShareOwnership | null>(
      `/properties/${propertyId}/shares/${ownerAddress}`
    );
    return response.data;
  },
};
