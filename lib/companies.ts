// Company shortlist: companies you want to follow, whether or not you have a job saved there.
import type { Db } from "./db";
import type { Actor, Status } from "./schema";

const TS = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

const CREATE_SQL = `
create table if not exists shortlisted_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  added_by text not null default 'me' check (added_by in ('me','claude')),
  created_at timestamptz not null default now()
);
create unique index if not exists shortlisted_companies_name_unique on shortlisted_companies (lower(name));
alter table shortlisted_companies enable row level security;`;

// Create the table once per server instance, so no manual database step is needed.
const ready = new WeakMap<Db, Promise<void>>();
async function ensureTable(db: Db): Promise<void> {
  let p = ready.get(db);
  if (!p) {
    p = (async () => {
      for (const stmt of CREATE_SQL.split(";").map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
    })();
    ready.set(db, p);
    p.catch(() => ready.delete(db));
  }
  return p;
}

export type ShortlistedCompany = {
  id: string;
  name: string;
  note: string | null;
  added_by: Actor;
  created_at: string;
  jobs: { id: string; role: string; status: Status; country: string | null }[];
};

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw new Error("Company name is empty");
  if (n.length > 200) throw new Error("Company name is too long");
  return n;
}

/** Add a company to the shortlist. If it is already there, keep it and update the note when one is given. */
export async function shortlistCompany(db: Db, name: string, note: string | null | undefined, by: Actor) {
  await ensureTable(db);
  const n = cleanName(name);
  const clean = note?.trim() || null;
  const rows = await db.query<{ id: string; created: boolean }>(
    `insert into shortlisted_companies (name, note, added_by) values ($1, $2, $3)
     on conflict (lower(name)) do update set note = coalesce(excluded.note, shortlisted_companies.note)
     returning id::text, (xmax = 0) as created`,
    [n, clean, by],
  );
  return { id: rows[0].id, name: n, created: !!rows[0].created };
}

export async function unshortlistCompany(db: Db, name: string): Promise<boolean> {
  await ensureTable(db);
  const rows = await db.query(`delete from shortlisted_companies where lower(name) = lower($1) returning id`, [name.trim()]);
  return rows.length > 0;
}

export async function updateCompanyNote(db: Db, name: string, note: string | null): Promise<void> {
  await ensureTable(db);
  await db.query(`update shortlisted_companies set note = $2 where lower(name) = lower($1)`, [name.trim(), note?.trim() || null]);
}

export async function isShortlisted(db: Db, name: string): Promise<boolean> {
  await ensureTable(db);
  const rows = await db.query(`select 1 from shortlisted_companies where lower(name) = lower($1)`, [name.trim()]);
  return rows.length > 0;
}

/** Every shortlisted company with the jobs you have tracked there (matched by company name). */
export async function listShortlist(db: Db): Promise<ShortlistedCompany[]> {
  await ensureTable(db);
  const companies = await db.query<Omit<ShortlistedCompany, "jobs">>(
    `select id::text, name, note, added_by, to_char(created_at at time zone 'utc', ${TS}) as created_at
     from shortlisted_companies order by lower(name)`,
  );
  if (!companies.length) return [];
  const jobs = await db.query<{ id: string; company: string; role: string; status: Status; country: string | null }>(
    `select j.id::text, j.company, j.role, j.status, j.country from jobs j
     join shortlisted_companies c on lower(j.company) = lower(c.name)
     order by j.updated_at desc`,
  );
  return companies.map((c) => ({
    ...c,
    jobs: jobs.filter((j) => j.company.toLowerCase() === c.name.toLowerCase()).map(({ company: _c, ...j }) => { void _c; return j; }),
  }));
}
