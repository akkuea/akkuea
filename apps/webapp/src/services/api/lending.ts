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
  userAddress: string;
  amount: number;
}

/**
 * Borrow payload
 */
export interface BorrowPayload {
  userAddress: string;
  collateralAmount: number;
  collateralAsset: string;
  borrowAmount: number;
}

export interface WithdrawPayload {
  userAddress: string;
  amount: number;
}

export interface RepayPayload {
  userAddress: string;
  amount: number;
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
  ): Promise<DepositPosition> {
    const response = await apiClient.post<DepositPosition>(
      `/lending/pools/${poolId}/deposit`,
      { amount: payload.amount.toString() },
      {
        headers: {
          "x-user-address": payload.userAddress,
        },
      },
    );
    return response.data;
  },

  /**
   * Borrow from pool
   */
  async borrow(
    poolId: string,
    payload: BorrowPayload,
  ): Promise<BorrowPosition> {
    const response = await apiClient.post<BorrowPosition>(
      `/lending/pools/${poolId}/borrow`,
      {
        borrowAmount: payload.borrowAmount.toString(),
        collateralAmount: payload.collateralAmount.toString(),
        collateralAsset: payload.collateralAsset,
      },
      {
        headers: {
          "x-user-address": payload.userAddress,
        },
      },
    );
    return response.data;
  },

  async withdraw(
    poolId: string,
    payload: WithdrawPayload,
  ): Promise<DepositPosition> {
    const response = await apiClient.post<DepositPosition>(
      `/lending/pools/${poolId}/withdraw`,
      { amount: payload.amount.toString() },
      {
        headers: {
          "x-user-address": payload.userAddress,
        },
      },
    );
    return response.data;
  },

  async repay(poolId: string, payload: RepayPayload): Promise<BorrowPosition> {
    const response = await apiClient.post<BorrowPosition>(
      `/lending/pools/${poolId}/repay`,
      { amount: payload.amount.toString() },
      {
        headers: {
          "x-user-address": payload.userAddress,
        },
      },
    );
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
