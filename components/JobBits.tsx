import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { STATUS_LABEL, type Job, type Status } from "@/lib/schema";

const TONE: Partial<Record<Status, string>> = {
  applied: "chip-accent",
  interview: "chip-warn",
  offer: "chip-good",
  rejected: "chip-bad",
};

export function StatusChip({ status }: { status: Status }) {
  return <span className={`chip ${TONE[status] ?? ""}`}>{STATUS_LABEL[status]}</span>;
}

export function ByClaude({ by }: { by: string }) {
  return by === "claude" ? <span className="chip chip-accent">by Claude</span> : null;
}

/** Small facts under a job title: country, work mode, relocation. */
export function JobMeta({ job }: { job: Job }) {
  const bits = [
    job.country,
    job.work_mode && job.work_mode !== job.country?.toLowerCase() ? job.work_mode : null,
    job.relocation === "yes" ? "relocation" : null,
    job.visa_support === "yes" ? "visa support" : null,
  ].filter(Boolean);
  return bits.length ? <span className="text-sm text-muted">{bits.join(" · ")}</span> : null;
}

export function JobRow({ job, right }: { job: Job; right?: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold truncate">{job.company}</span>
          <StatusChip status={job.status} />
          <ByClaude by={job.added_by} />
        </div>
        <div className="text-sm truncate">{job.role}</div>
        <JobMeta job={job} />
        {job.applied_on && <div className="text-xs text-muted">Applied {fmtDate(job.applied_on)}</div>}
      </Link>
      {right}
    </div>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="card p-6 text-center text-sm text-muted">{children}</p>;
}
