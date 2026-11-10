import { Empty, PageTitle } from "@/components/JobBits";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getStats } from "@/lib/jobs";
import { STATUSES, STATUS_LABEL } from "@/lib/schema";

function Bar({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
  const pct = max ? Math.max((value / max) * 100, value ? 3 : 0) : 0;
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate">{label}</span>
      <div className="h-3 rounded-full bg-line"><div className="h-3 rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
      <span className="tabular-nums font-semibold">{value}{note ? <span className="font-normal text-muted"> {note}</span> : null}</span>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default async function StatsPage() {
  const s = await getStats(getDb());
  if (s.total === 0) return (<><PageTitle title="Stats" /><Empty>Add some jobs to see numbers here.</Empty></>);
  const maxStatus = Math.max(...STATUSES.map((k) => s.by_status[k]));
  const maxWeek = Math.max(...s.applied_per_week.map((w) => w.applied), 0);
  const maxCountry = Math.max(...s.top_countries.map((c) => c.applied), 0);
  return (
    <>
      <PageTitle title="Stats" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Jobs tracked" value={String(s.total)} />
        <Tile label="Applied" value={String(s.applied_total)} sub="every job past Saved" />
        <Tile label="Replies" value={String(s.replied_total)} sub="interview, offer or rejected" />
        <Tile label="Reply rate" value={s.reply_rate_percent === null ? "–" : `${s.reply_rate_percent}%`} sub="replies ÷ applied" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2 p-4">
          <h2 className="mb-1 font-bold">By status</h2>
          {STATUSES.map((k) => <Bar key={k} label={STATUS_LABEL[k]} value={s.by_status[k]} max={maxStatus} />)}
        </section>
        <section className="card space-y-2 p-4">
          <h2 className="mb-1 font-bold">Applied per week</h2>
          {s.applied_per_week.length === 0 && <p className="text-sm text-muted">No applications yet.</p>}
          {s.applied_per_week.map((w) => <Bar key={w.week_start} label={fmtDate(w.week_start)} value={w.applied} max={maxWeek} />)}
        </section>
        <section className="card space-y-2 p-4 md:col-span-2">
          <h2 className="mb-1 font-bold">Top countries</h2>
          {s.top_countries.length === 0 && <p className="text-sm text-muted">No applications yet.</p>}
          {s.top_countries.map((c) => <Bar key={c.country} label={c.country} value={c.applied} max={maxCountry} note={`applied · ${c.replied} replied`} />)}
        </section>
      </div>
    </>
  );
}
