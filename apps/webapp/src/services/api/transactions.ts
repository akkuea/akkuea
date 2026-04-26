import type {
  Transaction,
  TransactionQueryParams,
  PaginatedTransactionResponse,
} from "@real-estate-defi/shared";
import { apiClient } from "./client";

/**
 * Transactions API service
 *
 * Fetches user transaction history with filtering and cursor-based pagination.
 */
export const transactionsApi = {
  /**
   * Get paginated transaction list with optional filters.
   *
   * @param params - Query parameters: cursor, limit, type, status, from, to, asset, since, until
   */
  async getTransactions(
    params?: Partial<TransactionQueryParams>,
  ): Promise<PaginatedTransactionResponse> {
    // Build query string from non-undefined params
    const searchParams = new URLSearchParams();

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      }
    }

    const query = searchParams.toString();
    const path = `/transactions${query ? `?${query}` : ""}`;

    const response = await apiClient.get<PaginatedTransactionResponse>(path);
    return response.data;
  },

  /**
   * Get a single transaction by ID.
   */
  async getTransaction(id: string): Promise<Transaction> {
    const response = await apiClient.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },
};
