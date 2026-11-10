import postgres from "postgres";

// The only thing lib/jobs.ts needs from a database.
// Production uses postgres.js; tests use an in-memory Postgres (PGlite).
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

type Sql = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { __jobTrackerSql?: Sql };

// Vercel pauses the app between requests. A database connection left open during a pause
// can be dead when the app wakes up, and a query on it would hang. So: close idle
// connections quickly, give every query a time limit, and on a timeout throw the
// connections away and try once more on fresh ones.
const QUERY_TIMEOUT_MS = 8000;

function connect(url: string): Sql {
  return postgres(url, {
    prepare: false, // needed for Supabase's transaction pooler
    max: 4, // lets a page run its few queries side by side
    idle_timeout: 2, // seconds; close connections soon after a request finishes
    max_lifetime: 60 * 5,
    connect_timeout: 5,
  });
}

function pool(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return (globalForDb.__jobTrackerSql ??= connect(url));
}

function resetPool(sql: Sql) {
  if (globalForDb.__jobTrackerSql === sql) globalForDb.__jobTrackerSql = undefined;
  sql.end({ timeout: 0 }).catch(() => {});
}

class QueryTimeout extends Error {}

async function runOnce<T>(sql: Sql, text: string, params: unknown[]): Promise<T[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new QueryTimeout("Database query timed out")), QUERY_TIMEOUT_MS);
  });
  try {
    const rows = await Promise.race([sql.unsafe(text, params as never[]), timeout]);
    return rows as unknown as T[];
  } finally {
    clearTimeout(timer);
  }
}

export function getDb(): Db {
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const sql = pool();
      try {
        return await runOnce<T>(sql, text, params);
      } catch (e) {
        const dead =
          e instanceof QueryTimeout ||
          (e instanceof Error && /CONNECTION_(CLOSED|ENDED|DESTROYED)|ECONNRESET|EPIPE|terminat/i.test(`${(e as { code?: string }).code ?? ""} ${e.message}`));
        if (!dead) throw e;
        console.warn("[db] connection looked dead, retrying on a fresh one:", e.message);
        resetPool(sql);
        return runOnce<T>(pool(), text, params);
      }
    },
  };
}
