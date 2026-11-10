// All job rules live here. The web app and the MCP tools both call this file,
// so Claude and the app always behave the same way.
import type { Db } from "./db";
import {
  JobInput,
  JobPatch,
  STATUSES,
  type Actor,
  type Job,
  type JobEvent,
  type Status,
} from "./schema";

const TZ = () => process.env.APP_TIMEZONE || "Asia/Dhaka";
const TS = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

const JOB_COLS = `
  id::text, company, role, url, country, work_mode, relocation, visa_support, status,
  source, salary_text, applied_on::text, follow_up_on::text, cv_version, cover_letter,
  contact, notes, added_by,
  to_char(created_at at time zone 'utc', ${TS}) as created_at,
  to_char(updated_at at time zone 'utc', ${TS}) as updated_at`;

const EVENT_COLS = `
  id::text, job_id::text, kind, from_status, to_status, text, by,
  to_char(at at time zone 'utc', ${TS}) as at`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED: Status[] = ["offer", "rejected", "ghosted", "withdrawn"];
export const FOLLOW_UP_DAYS = 7;
export const STALE_SAVED_DAYS = 3;

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`No job with id ${id}`);
  }
}

/** Trim the link and drop tracking parts, so the same post is caught as a duplicate. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|refid$|trk$|trackingid$)/i.test(key)) u.searchParams.delete(key);
    }
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return trimmed;
  }
}

export async function today(db: Db): Promise<string> {
  const rows = await db.query<{ d: string }>(`select (now() at time zone $1)::date::text as d`, [TZ()]);
  return rows[0].d;
}

async function logEvent(
  db: Db,
  e: { job_id: string; kind: JobEvent["kind"]; from?: Status | null; to?: Status | null; text?: string | null; by: Actor },
) {
  await db.query(
    `insert into job_events (job_id, kind, from_status, to_status, text, by) values ($1,$2,$3,$4,$5,$6)`,
    [e.job_id, e.kind, e.from ?? null, e.to ?? null, e.text ?? null, e.by],
  );
}

async function loadJob(db: Db, id: string): Promise<Job> {
  if (!UUID.test(id)) throw new NotFoundError(id);
  const rows = await db.query<Job>(`select ${JOB_COLS} from jobs where id = $1`, [id]);
  if (!rows[0]) throw new NotFoundError(id);
  return rows[0];
}

/** Create a job. If the link is already tracked, return that job instead. */
export async function addJob(db: Db, input: JobInput, by: Actor): Promise<{ job: Job; duplicate: boolean }> {
  const data = JobInput.parse(input);
  const url = normalizeUrl(data.url);
  if (url) {
    const existing = await db.query<Job>(`select ${JOB_COLS} from jobs where url = $1`, [url]);
    if (existing[0]) return { job: existing[0], duplicate: true };
  }
  const day = await today(db);
  let applied_on = data.applied_on;
  let follow_up_on = data.follow_up_on;
  if (data.status !== "saved" && !applied_on) applied_on = day;
  if (data.status === "applied" && !follow_up_on) follow_up_on = addDays(applied_on ?? day, FOLLOW_UP_DAYS);

  const rows = await db.query<Job>(
    `insert into jobs (company, role, url, country, work_mode, relocation, visa_support, status, source,
       salary_text, applied_on, follow_up_on, cv_version, cover_letter, contact, notes, added_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12::date,$13,$14,$15,$16,$17)
     returning ${JOB_COLS}`,
    [
      data.company, data.role, url, data.country, data.work_mode, data.relocation, data.visa_support,
      data.status, data.source, data.salary_text, applied_on, follow_up_on, data.cv_version,
      data.cover_letter, data.contact, data.notes, by,
    ],
  );
  const job = rows[0];
  await logEvent(db, { job_id: job.id, kind: "created", to: job.status, by });
  return { job, duplicate: false };
}

export type FindFilter = {
  text?: string;
  status?: Status | Status[];
  country?: string;
  source?: string;
  from?: string; // created on or after, YYYY-MM-DD
  to?: string; // created on or before, YYYY-MM-DD
  limit?: number;
};

export async function findJobs(db: Db, f: FindFilter = {}): Promise<Job[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.text?.trim()) {
    const like = p(`%${f.text.trim().replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(company ilike ${like} or role ilike ${like} or coalesce(notes,'') ilike ${like} or coalesce(url,'') ilike ${like})`);
  }
  const statuses = (Array.isArray(f.status) ? f.status : f.status ? [f.status] : []).filter((s) =>
    STATUSES.includes(s),
  );
  if (statuses.length) where.push(`status in (${statuses.map((s) => p(s)).join(",")})`);
  if (f.country?.trim()) where.push(`country ilike ${p(f.country.trim())}`);
  if (f.source?.trim()) where.push(`source ilike ${p(f.source.trim())}`);
  if (f.from) where.push(`(created_at at time zone ${p(TZ())})::date >= ${p(f.from)}::date`);
  if (f.to) where.push(`(created_at at time zone ${p(TZ())})::date <= ${p(f.to)}::date`);
  const limit = Math.min(Math.max(f.limit ?? 200, 1), 500);
  return db.query<Job>(
    `select ${JOB_COLS} from jobs ${where.length ? "where " + where.join(" and ") : ""}
     order by jobs.updated_at desc limit ${limit}`,
    params,
  );
}

export async function getJob(db: Db, id: string): Promise<{ job: Job; events: JobEvent[] }> {
  const job = await loadJob(db, id);
  const events = await db.query<JobEvent>(
    `select ${EVENT_COLS} from job_events where job_id = $1 order by job_events.at desc, id`,
    [id],
  );
  return { job, events };
}

export async function updateJob(db: Db, id: string, patch: JobPatch, by: Actor): Promise<Job> {
  await loadJob(db, id);
  const data = JobPatch.parse(patch) as Record<string, unknown>;
  if ("url" in data) data.url = normalizeUrl(data.url as string | null);
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (keys.length === 0) return loadJob(db, id);
  const dateCols = new Set(["applied_on", "follow_up_on"]);
  const sets = keys.map((k, i) => `${k} = $${i + 2}${dateCols.has(k) ? "::date" : ""}`);
  const rows = await db.query<Job>(
    `update jobs set ${sets.join(", ")}, updated_at = now() where id = $1 returning ${JOB_COLS}`,
    [id, ...keys.map((k) => data[k])],
  );
  void by;
  return rows[0];
}

/** Move a job to a new status and record it in the history. */
export async function setStatus(db: Db, id: string, status: Status, note: string | null | undefined, by: Actor): Promise<Job> {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);
  const before = await loadJob(db, id);
  const text = note?.trim() || null;
  if (before.status === status) {
    if (text) await addNote(db, id, text, "note", by);
    return loadJob(db, id);
  }
  const day = await today(db);
  let applied_on = before.applied_on;
  let follow_up_on = before.follow_up_on;
  // Rule: the first time a job leaves "saved", remember the day you applied.
  if (status !== "saved" && !applied_on) applied_on = day;
  // Rule: a new application gets a follow-up reminder one week later.
  if (status === "applied" && !follow_up_on) follow_up_on = addDays(day, FOLLOW_UP_DAYS);
  // Rule: finished jobs need no follow-up.
  if (CLOSED.includes(status)) follow_up_on = null;

  const rows = await db.query<Job>(
    `update jobs set status = $2, applied_on = $3::date, follow_up_on = $4::date, updated_at = now()
     where id = $1 returning ${JOB_COLS}`,
    [id, status, applied_on, follow_up_on],
  );
  await logEvent(db, { job_id: id, kind: "status_change", from: before.status, to: status, text, by });
  return rows[0];
}

export async function addNote(db: Db, id: string, text: string, kind: "note" | "interview", by: Actor): Promise<void> {
  await loadJob(db, id);
  const clean = text.trim();
  if (!clean) throw new Error("Note text is empty");
  await logEvent(db, { job_id: id, kind, text: clean, by });
  await db.query(`update jobs set updated_at = now() where id = $1`, [id]);
}

export async function deleteJob(db: Db, id: string): Promise<void> {
  await loadJob(db, id);
  await db.query(`delete from jobs where id = $1`, [id]);
}

export type TodayView = {
  today: string;
  followups: Job[]; // follow_up_on is today or earlier (or within daysAhead)
  interviews: Job[]; // jobs currently in the interview stage
  stale_saved: Job[]; // saved more than 3 days ago and still not applied
};

export async function dueFollowups(db: Db, daysAhead = 0): Promise<TodayView> {
  const day = await today(db);
  const ahead = Math.min(Math.max(Math.trunc(daysAhead) || 0, 0), 60);
  const followups = await db.query<Job>(
    `select ${JOB_COLS} from jobs
     where follow_up_on is not null and follow_up_on <= $1::date + $2::int
       and status in ('saved','applied','interview')
     order by follow_up_on, company`,
    [day, ahead],
  );
  const interviews = await db.query<Job>(
    `select ${JOB_COLS} from jobs where status = 'interview' order by jobs.updated_at desc`,
  );
  const stale_saved = await db.query<Job>(
    `select ${JOB_COLS} from jobs
     where status = 'saved' and (created_at at time zone $2)::date <= $1::date - ${STALE_SAVED_DAYS}
     order by jobs.created_at`,
    [day, TZ()],
  );
  return { today: day, followups, interviews, stale_saved };
}

export type Stats = {
  total: number;
  by_status: Record<Status, number>;
  applied_total: number; // jobs you applied to (any status after "saved")
  replied_total: number; // of those, jobs that reached interview, offer or rejected
  reply_rate_percent: number | null; // replied_total / applied_total * 100
  top_countries: { country: string; applied: number; replied: number }[];
  applied_per_week: { week_start: string; applied: number }[];
};

export async function getStats(db: Db, range: { from?: string; to?: string } = {}): Promise<Stats> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (range.from) {
    params.push(range.from);
    where.push(`coalesce(applied_on, (created_at at time zone '${TZ().replace(/'/g, "")}')::date) >= $${params.length}::date`);
  }
  if (range.to) {
    params.push(range.to);
    where.push(`coalesce(applied_on, (created_at at time zone '${TZ().replace(/'/g, "")}')::date) <= $${params.length}::date`);
  }
  const w = where.length ? "where " + where.join(" and ") : "";
  const replied = `status in ('interview','offer','rejected')`;

  const statusRows = await db.query<{ status: Status; n: number }>(
    `select status, count(*)::int as n from jobs ${w} group by status`,
    params,
  );
  const by_status = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const r of statusRows) by_status[r.status] = Number(r.n);
  const total = Object.values(by_status).reduce((a, b) => a + b, 0);

  const totals = await db.query<{ applied: number; replied: number }>(
    `select count(*) filter (where applied_on is not null)::int as applied,
            count(*) filter (where applied_on is not null and ${replied})::int as replied
     from jobs ${w}`,
    params,
  );
  const applied_total = Number(totals[0].applied);
  const replied_total = Number(totals[0].replied);

  const countries = await db.query<{ country: string; applied: number; replied: number }>(
    `select coalesce(country, 'Unknown') as country,
            count(*)::int as applied,
            count(*) filter (where ${replied})::int as replied
     from jobs ${w ? w + " and" : "where"} applied_on is not null
     group by 1 order by applied desc, country limit 8`,
    params,
  );
  const weeks = await db.query<{ week_start: string; applied: number }>(
    `select date_trunc('week', applied_on)::date::text as week_start, count(*)::int as applied
     from jobs ${w ? w + " and" : "where"} applied_on is not null
     group by 1 order by 1 desc limit 12`,
    params,
  );
  return {
    total,
    by_status,
    applied_total,
    replied_total,
    reply_rate_percent: applied_total ? Math.round((replied_total / applied_total) * 1000) / 10 : null,
    top_countries: countries.map((c) => ({ ...c, applied: Number(c.applied), replied: Number(c.replied) })),
    applied_per_week: weeks.map((x) => ({ ...x, applied: Number(x.applied) })).reverse(),
  };
}

/** Distinct values already used, for filter dropdowns. */
export async function listFacets(db: Db): Promise<{ countries: string[]; sources: string[] }> {
  const c = await db.query<{ v: string }>(`select distinct country as v from jobs where country is not null order by 1`);
  const s = await db.query<{ v: string }>(`select distinct source as v from jobs where source is not null order by 1`);
  return { countries: c.map((r) => r.v), sources: s.map((r) => r.v) };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
