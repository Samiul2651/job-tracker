import postgres from "postgres";

// The only thing lib/jobs.ts needs from a database.
// Production uses postgres.js; tests use an in-memory Postgres (PGlite).
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

const globalForDb = globalThis as unknown as { __jobTrackerSql?: ReturnType<typeof postgres> };

export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = (globalForDb.__jobTrackerSql ??= postgres(url, {
    prepare: false, // needed for Supabase's transaction pooler
    max: 1,
    idle_timeout: 20,
  }));
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as never[]);
      return rows as unknown as T[];
    },
  };
}
