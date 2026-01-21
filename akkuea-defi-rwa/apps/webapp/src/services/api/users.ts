import type { User, Transaction, KycDocument } from '@real-estate-defi/shared';
import { apiClient } from './client';

/**
 * Connect wallet payload
 */
export interface ConnectWalletPayload {
  signature: string;
  message: string;
}

/**
 * Submit KYC payload
 */
export interface SubmitKycPayload {
  userId: string;
  documents: {
    type: 'passport' | 'id_card' | 'proof_of_address' | 'other';
    documentUrl: string;
  }[];
}

/**
 * User API service
 */
export const userApi = {
  /**
   * Get user by wallet address
   */
  async getByWallet(walletAddress: string): Promise<User> {
    const response = await apiClient.get<User>(`/users/${walletAddress}`);
    return response.data;
  },

  /**
   * Connect wallet
   */
  async connectWallet(
    address: string,
    payload: ConnectWalletPayload
  ): Promise<{ token: string; user: User }> {
    const response = await apiClient.post<{ token: string; user: User }>(
      `/users/${address}/wallet`,
      payload
    );
    return response.data;
  },

  /**
   * Get user's transactions
   */
  async getTransactions(address: string): Promise<Transaction[]> {
    const response = await apiClient.get<Transaction[]>(`/users/${address}/transactions`);
    return response.data;
  },

  /**
   * Get user's portfolio
   */
  async getPortfolio(address: string): Promise<{
    properties: Array<{ propertyId: string; shares: number }>;
    deposits: Array<{ poolId: string; amount: number }>;
    borrows: Array<{ poolId: string; amount: number }>;
  }> {
    const response = await apiClient.get<{
      properties: Array<{ propertyId: string; shares: number }>;
      deposits: Array<{ poolId: string; amount: number }>;
      borrows: Array<{ poolId: string; amount: number }>;
    }>(`/users/${address}/portfolio`);
    return response.data;
  },

  /**
   * Get KYC status
   */
  async getKycStatus(userId: string): Promise<{ status: string; tier?: string }> {
    const response = await apiClient.get<{ status: string; tier?: string }>(
      `/kyc/status/${userId}`
    );
    return response.data;
  },

  /**
   * Submit KYC for verification
   */
  async submitKyc(payload: SubmitKycPayload): Promise<{ status: string; message: string }> {
    const response = await apiClient.post<{ status: string; message: string }>(
      '/kyc/submit',
      payload
    );
    return response.data;
  },

  /**
   * Get user's KYC documents
   */
  async getKycDocuments(userId: string): Promise<KycDocument[]> {
    const response = await apiClient.get<KycDocument[]>(`/kyc/documents/${userId}`);
    return response.data;
  },
};
