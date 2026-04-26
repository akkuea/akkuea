# C1-004: Add API Client Service Layer

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                        |
| --------------- | ---------------------------- |
| Issue ID        | C1-004                       |
| Title           | Add API client service layer |
| Area            | WEBAPP                       |
| Difficulty      | Medium                       |
| Labels          | frontend, api, medium        |
| Dependencies    | None                         |
| Estimated Lines | 200-300                      |

## Overview

This issue creates a type-safe API client layer that abstracts HTTP communication with the backend. Using a centralized client ensures consistent error handling, authentication, and request formatting across the application.

## Prerequisites

- Understanding of fetch API and async/await
- Familiarity with TypeScript generics
- Access to shared types from `@akkuea/shared`

## Implementation Steps

### Step 1: Create API Types

Create `apps/webapp/src/services/api/types.ts`:

```typescript
/**
 * API response wrapper type
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

/**
 * API error response
 */
export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Request configuration options
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Custom error classes
 */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export class AuthenticationError extends ApiRequestError {
  constructor(message: string = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
    this.name = "AuthenticationError";
  }
}

export class NetworkError extends Error {
  constructor(message: string = "Network error occurred") {
    super(message);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}
```

### Step 2: Create Base API Client

Create `apps/webapp/src/services/api/client.ts`:

```typescript
import {
  ApiResponse,
  ApiRequestError,
  AuthenticationError,
  NetworkError,
  TimeoutError,
  RequestConfig,
} from "./types";

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Base API client configuration
 */
interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  getAuthToken?: () => string | null;
  onUnauthorized?: () => void;
}

/**
 * Create a configured API client instance
 */
export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, defaultHeaders = {}, getAuthToken, onUnauthorized } = config;

  /**
   * Build request headers
   */
  function buildHeaders(customHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      "Content-Type": "application/json",
      ...defaultHeaders,
      ...customHeaders,
    });

    const token = getAuthToken?.();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
  }

  /**
   * Fetch with timeout
   */
  async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(
          `Request to ${url} timed out after ${timeout}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sleep utility for retry delay
   */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  function isRetryable(status: number): boolean {
    return status >= 500 || status === 429;
  }

  /**
   * Parse error response
   */
  async function parseErrorResponse(
    response: Response,
  ): Promise<ApiRequestError> {
    try {
      const body = await response.json();
      return new ApiRequestError(
        response.status,
        body.code || "UNKNOWN_ERROR",
        body.message || response.statusText,
        body.details,
      );
    } catch {
      return new ApiRequestError(
        response.status,
        "UNKNOWN_ERROR",
        response.statusText,
      );
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    config: RequestConfig = {},
  ): Promise<ApiResponse<T>> {
    const {
      headers: customHeaders,
      timeout = DEFAULT_TIMEOUT,
      retries = DEFAULT_RETRIES,
      retryDelay = DEFAULT_RETRY_DELAY,
    } = config;

    const url = `${baseUrl}${path}`;
    const headers = buildHeaders(customHeaders);

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        const response = await fetchWithTimeout(url, options, timeout);

        // Handle 401 Unauthorized
        if (response.status === 401) {
          onUnauthorized?.();
          throw new AuthenticationError();
        }

        // Handle error responses
        if (!response.ok) {
          const error = await parseErrorResponse(response);

          // Retry on server errors
          if (isRetryable(response.status) && attempt < retries) {
            lastError = error;
            attempt++;
            await sleep(retryDelay * attempt);
            continue;
          }

          throw error;
        }

        // Parse successful response
        const data = await response.json();
        return {
          data: data as T,
          status: response.status,
        };
      } catch (error) {
        if (
          error instanceof AuthenticationError ||
          error instanceof ApiRequestError
        ) {
          throw error;
        }

        if (error instanceof TimeoutError) {
          if (attempt < retries) {
            lastError = error;
            attempt++;
            await sleep(retryDelay * attempt);
            continue;
          }
          throw error;
        }

        // Network error
        if (attempt < retries) {
          lastError = error instanceof Error ? error : new Error(String(error));
          attempt++;
          await sleep(retryDelay * attempt);
          continue;
        }

        throw new NetworkError(
          error instanceof Error ? error.message : "Network request failed",
        );
      }
    }

    throw lastError || new NetworkError("Request failed after retries");
  }

  return {
    /**
     * GET request
     */
    get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
      return request<T>("GET", path, undefined, config);
    },

    /**
     * POST request
     */
    post<T>(
      path: string,
      body?: unknown,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      return request<T>("POST", path, body, config);
    },

    /**
     * PUT request
     */
    put<T>(
      path: string,
      body?: unknown,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      return request<T>("PUT", path, body, config);
    },

    /**
     * PATCH request
     */
    patch<T>(
      path: string,
      body?: unknown,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      return request<T>("PATCH", path, body, config);
    },

    /**
     * DELETE request
     */
    delete<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
      return request<T>("DELETE", path, undefined, config);
    },
  };
}

/**
 * Default API client instance
 */
export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  getAuthToken: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token");
    }
    return null;
  },
  onUnauthorized: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
  },
});
```

### Step 3: Create Property API Service

Create `apps/webapp/src/services/api/properties.ts`:

```typescript
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
   * Buy property shares
   */
  async buyShares(
    id: string,
    shares: number,
  ): Promise<{ transactionHash: string; newBalance: number }> {
    const response = await apiClient.post<{
      transactionHash: string;
      newBalance: number;
    }>(`/properties/${id}/buy-shares`, { shares });
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

  /**
   * Get all properties owned by user
   */
  async getByOwner(ownerAddress: string): Promise<PropertyInfo[]> {
    const response = await apiClient.get<PropertyInfo[]>(
      `/properties?owner=${ownerAddress}`,
    );
    return response.data;
  },
};
```

### Step 4: Create Lending API Service

Create `apps/webapp/src/services/api/lending.ts`:

```typescript
import type {
  LendingPool,
  DepositPosition,
  BorrowPosition,
} from "@akkuea/shared";
import { apiClient } from "./client";

/**
 * Deposit payload
 */
export interface DepositPayload {
  amount: string;
}

/**
 * Borrow payload
 */
export interface BorrowPayload {
  amount: string;
  collateralAmount: string;
  collateralAsset: string;
}

/**
 * Lending API service
 */
export const lendingApi = {
  /**
   * Get all lending pools
   */
  async getPools(): Promise<LendingPool[]> {
    const response = await apiClient.get<LendingPool[]>("/lending/pools");
    return response.data;
  },

  /**
   * Get pool by ID
   */
  async getPool(id: string): Promise<LendingPool> {
    const response = await apiClient.get<LendingPool>(`/lending/pools/${id}`);
    return response.data;
  },

  /**
   * Deposit into pool
   */
  async deposit(
    poolId: string,
    payload: DepositPayload,
  ): Promise<{ transactionHash: string; position: DepositPosition }> {
    const response = await apiClient.post<{
      transactionHash: string;
      position: DepositPosition;
    }>(`/lending/pools/${poolId}/deposit`, payload);
    return response.data;
  },

  /**
   * Withdraw from pool
   */
  async withdraw(
    poolId: string,
    amount: string,
  ): Promise<{ transactionHash: string; withdrawn: string }> {
    const response = await apiClient.post<{
      transactionHash: string;
      withdrawn: string;
    }>(`/lending/pools/${poolId}/withdraw`, { amount });
    return response.data;
  },

  /**
   * Borrow from pool
   */
  async borrow(
    poolId: string,
    payload: BorrowPayload,
  ): Promise<{ transactionHash: string; position: BorrowPosition }> {
    const response = await apiClient.post<{
      transactionHash: string;
      position: BorrowPosition;
    }>(`/lending/pools/${poolId}/borrow`, payload);
    return response.data;
  },

  /**
   * Repay loan
   */
  async repay(
    poolId: string,
    amount: string,
  ): Promise<{ transactionHash: string; remainingDebt: string }> {
    const response = await apiClient.post<{
      transactionHash: string;
      remainingDebt: string;
    }>(`/lending/pools/${poolId}/repay`, { amount });
    return response.data;
  },

  /**
   * Get user's deposit positions
   */
  async getUserDeposits(
    poolId: string,
    userAddress: string,
  ): Promise<DepositPosition[]> {
    const response = await apiClient.get<DepositPosition[]>(
      `/lending/pools/${poolId}/user/${userAddress}/deposits`,
    );
    return response.data;
  },

  /**
   * Get user's borrow positions
   */
  async getUserBorrows(
    poolId: string,
    userAddress: string,
  ): Promise<BorrowPosition[]> {
    const response = await apiClient.get<BorrowPosition[]>(
      `/lending/pools/${poolId}/user/${userAddress}/borrows`,
    );
    return response.data;
  },
};
```

### Step 5: Create User API Service

Create `apps/webapp/src/services/api/users.ts`:

```typescript
import type { User, KycDocument } from "@akkuea/shared";
import { apiClient } from "./client";

/**
 * User update payload
 */
export interface UpdateUserPayload {
  email?: string;
  displayName?: string;
}

/**
 * KYC document upload payload
 */
export interface UploadKycDocumentPayload {
  type: string;
  fileName: string;
  fileUrl: string;
}

/**
 * User API service
 */
export const userApi = {
  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    const response = await apiClient.get<User>("/users/me");
    return response.data;
  },

  /**
   * Get user by wallet address
   */
  async getByWallet(walletAddress: string): Promise<User> {
    const response = await apiClient.get<User>(
      `/users/wallet/${walletAddress}`,
    );
    return response.data;
  },

  /**
   * Update user profile
   */
  async updateProfile(payload: UpdateUserPayload): Promise<User> {
    const response = await apiClient.patch<User>("/users/me", payload);
    return response.data;
  },

  /**
   * Get user's KYC documents
   */
  async getKycDocuments(): Promise<KycDocument[]> {
    const response = await apiClient.get<KycDocument[]>("/kyc/documents");
    return response.data;
  },

  /**
   * Upload KYC document
   */
  async uploadKycDocument(
    payload: UploadKycDocumentPayload,
  ): Promise<KycDocument> {
    const response = await apiClient.post<KycDocument>(
      "/kyc/documents",
      payload,
    );
    return response.data;
  },

  /**
   * Submit KYC for verification
   */
  async submitKyc(): Promise<{ status: string; message: string }> {
    const response = await apiClient.post<{ status: string; message: string }>(
      "/kyc/submit",
    );
    return response.data;
  },
};
```

### Step 6: Create Service Index

Create `apps/webapp/src/services/api/index.ts`:

```typescript
export * from "./types";
export * from "./client";
export { propertyApi } from "./properties";
export { lendingApi } from "./lending";
export { userApi } from "./users";
```

Create `apps/webapp/src/services/index.ts`:

```typescript
export * from "./api";
```

## Usage Example

```typescript
import { propertyApi, lendingApi, userApi, ApiRequestError } from "@/services";

// Fetch properties
async function loadProperties() {
  try {
    const properties = await propertyApi.getAll({
      page: 1,
      limit: 10,
      propertyType: "residential",
    });
    console.log(properties.data);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error(`API Error: ${error.code} - ${error.message}`);
    }
  }
}

// Buy shares
async function buyPropertyShares(propertyId: string, shares: number) {
  const result = await propertyApi.buyShares(propertyId, shares);
  console.log(`Transaction: ${result.transactionHash}`);
}
```

## Related Resources

| Resource                | Link                                                                        |
| ----------------------- | --------------------------------------------------------------------------- |
| Fetch API               | https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API                  |
| TypeScript Generics     | https://www.typescriptlang.org/docs/handbook/2/generics.html                |
| Error Handling Patterns | https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript |

## Verification Checklist

| Item                         | Status |
| ---------------------------- | ------ |
| Base client created          |        |
| All API services implemented |        |
| Type safety verified         |        |
| Error handling complete      |        |
| Retry logic working          |        |
| Timeout handling working     |        |
| Services exported            |        |
