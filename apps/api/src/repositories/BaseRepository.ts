import { db } from '../db';
import { eq, type SQL, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';

type TableWithId = PgTable & {
  id: PgColumn;
};

export abstract class BaseRepository<
  TTable extends TableWithId,
  TSelect = InferSelectModel<TTable>,
  TInsert = InferInsertModel<TTable>,
> {
  constructor(protected readonly table: TTable) {}

  async findAll(): Promise<TSelect[]> {
    const results = await db.select().from(this.table);
    return results as TSelect[];
  }

  async findById(id: string): Promise<TSelect | undefined> {
    const results = await db.select().from(this.table).where(eq(this.table.id, id));
    return results[0] as TSelect | undefined;
  }

  async findWhere(condition: SQL): Promise<TSelect[]> {
    const results = await db.select().from(this.table).where(condition);
    return results as TSelect[];
  }

  async create(data: TInsert): Promise<TSelect> {
    const results = await db
      .insert(this.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values(data as any)
      .returning();
    return results[0] as TSelect;
  }

  async createMany(data: TInsert[]): Promise<TSelect[]> {
    const results = await db
      .insert(this.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values(data as any)
      .returning();
    return results as TSelect[];
  }

  async update(id: string, data: Partial<TInsert>): Promise<TSelect | undefined> {
    const results = await db
      .update(this.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning();
    return results[0] as TSelect | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const results = await db.delete(this.table).where(eq(this.table.id, id)).returning();
    return results.length > 0;
  }

  async count(): Promise<number> {
    const results = await db.select().from(this.table);
    return results.length;
  }
}
