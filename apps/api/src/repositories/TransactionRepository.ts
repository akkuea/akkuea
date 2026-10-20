import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { BaseRepository } from './BaseRepository';
import { transactions, type Transaction, type NewTransaction } from '../db/schema/transactions';

export class TransactionRepository extends BaseRepository<
  typeof transactions,
  Transaction,
  NewTransaction
> {
  constructor() {
    super(transactions);
  }

  async findByHash(hash: string): Promise<Transaction | undefined> {
    const results = await this.findWhere(eq(transactions.hash, hash));
    return results[0];
  }

  async updateStatus(id: string, status: 'confirmed' | 'failed'): Promise<Transaction | undefined> {
    return this.update(id, { status });
  }

  async updateStatusIfPending(
    id: string,
    status: 'confirmed' | 'failed',
  ): Promise<Transaction | undefined> {
    const results = await db
      .update(transactions)
      .set({ status })
      .where(and(eq(transactions.id, id), eq(transactions.status, 'pending')))
      .returning();
    return results[0];
  }
}

export const transactionRepository = new TransactionRepository();
