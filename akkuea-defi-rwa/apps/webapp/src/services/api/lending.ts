import type {
  LendingPool,
  DepositPosition,
  BorrowPosition,
} from "@real-estate-defi/shared";
import { apiClient } from "./client";

/**
 * Deposit payload
 */
export interface DepositPayload {
  user: string;
  amount: number;
}

/**
 * Borrow payload
 */
export interface BorrowPayload {
  borrower: string;
  collateralPropertyId: string;
  collateralShares: number;
  borrowAmount: number;
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
