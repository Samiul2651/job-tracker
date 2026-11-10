import Link from "next/link";
import { Empty, JobRow, PageTitle } from "@/components/JobBits";
import { getDb } from "@/lib/db";
import { findJobs, listFacets } from "@/lib/jobs";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/schema";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default async function ListPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const q = one(sp.q), status = one(sp.status), country = one(sp.country), source = one(sp.source);
  const db = getDb();
  const [jobs, facets] = await Promise.all([
    findJobs(db, {
      text: q,
      status: STATUSES.includes(status as Status) ? (status as Status) : undefined,
      country,
      source,
    }),
    listFacets(db),
  ]);
  const filtered = q || status || country || source;
  return (
    <>
      <PageTitle title="All jobs" sub={`${jobs.length} job${jobs.length === 1 ? "" : "s"}${filtered ? " found" : ""}`} />
      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-5" role="search">
        <input name="q" defaultValue={q} placeholder="Search company, role, notes" aria-label="Search" className="input sm:col-span-2" />
        <select name="status" defaultValue={status} aria-label="Status" className="input">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select name="country" defaultValue={country} aria-label="Country" className="input">
          <option value="">Any country</option>
          {facets.countries.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select name="source" defaultValue={source} aria-label="Source" className="input">
          <option value="">Any source</option>
          {facets.sources.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="flex gap-2 sm:col-span-5">
          <button className="btn btn-primary btn-sm">Filter</button>
          {filtered && <Link href="/list" className="btn btn-sm">Clear</Link>}
        </div>
      </form>
      {jobs.length === 0 ? (
        <Empty>{filtered ? "No jobs match these filters." : "No jobs yet. Add one with the + button, or ask Claude to add it."}</Empty>
      ) : (
        <div className="space-y-2">{jobs.map((j) => <JobRow key={j.id} job={j} />)}</div>
      )}
    </>
  );
}
