import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, type User, type NewUser } from '../db/schema';
import { BaseRepository } from './BaseRepository';

export class UserRepository extends BaseRepository<typeof users, User, NewUser> {
  constructor() {
    super(users);
  }

  /**
   * Find user by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<User | undefined> {
    const results = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress))
      .limit(1);

    return results[0];
  }

  /**
   * Check if wallet address exists
   */
  async walletExists(walletAddress: string): Promise<boolean> {
    const user = await this.findByWalletAddress(walletAddress);
    return !!user;
  }

  /**
   * Create user with wallet address
   */
  async createUser(data: {
    walletAddress: string;
    email?: string;
    displayName?: string;
  }): Promise<User> {
    return this.create({
      walletAddress: data.walletAddress,
      email: data.email || null,
      displayName: data.displayName || null,
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(
    id: string,
    data: { email?: string; displayName?: string }
  ): Promise<User | undefined> {
    const updateData: Partial<NewUser> = {
      updatedAt: new Date(),
    };

    if (data.email !== undefined) {
      updateData.email = data.email;
    }

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName;
    }

    return this.update(id, updateData);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  /**
   * Get or create user by wallet
   */
  async getOrCreateByWallet(walletAddress: string): Promise<User> {
    const existing = await this.findByWalletAddress(walletAddress);

    if (existing) {
      await this.updateLastLogin(existing.id);
      return existing;
    }

    return this.createUser({ walletAddress });
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
