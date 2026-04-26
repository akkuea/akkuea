import { eq } from 'drizzle-orm';
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
}

export const transactionRepository = new TransactionRepository();
