import Link from "next/link";
import { notFound } from "next/navigation";
import { updateJobAction } from "@/app/actions";
import { ByClaude, JobMeta, PageTitle, StatusChip } from "@/components/JobBits";
import { DeleteButton, NoteForm, StatusPicker } from "@/components/JobDetailClient";
import { JobForm } from "@/components/JobForm";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { NotFoundError, getJob } from "@/lib/jobs";
import { STATUS_LABEL, type JobEvent } from "@/lib/schema";

function eventText(e: JobEvent): string {
  if (e.kind === "created") return "Added to the tracker";
  if (e.kind === "status_change") return `${STATUS_LABEL[e.from_status!] ?? "?"} → ${STATUS_LABEL[e.to_status!] ?? "?"}`;
  return e.kind === "interview" ? "Interview" : "Note";
}

function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> };

export default async function JobPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { edit } = await searchParams;
  let data;
  try {
    data = await getJob(getDb(), id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { job, events } = data;

  if (edit) {
    return (
      <div className="max-w-2xl">
        <PageTitle title={`Edit ${job.company}`} />
        <JobForm action={updateJobAction.bind(null, job.id)} job={job} cancelHref={`/jobs/${job.id}`} />
      </div>
    );
  }

  const href = job.url ? safeHref(job.url) : null;
  const facts: [string, string | null][] = [
    ["Applied on", job.applied_on && fmtDate(job.applied_on)],
    ["Follow up on", job.follow_up_on && fmtDate(job.follow_up_on)],
    ["Source", job.source],
    ["Salary", job.salary_text],
    ["Relocation", job.relocation],
    ["Visa support", job.visa_support],
    ["CV version", job.cv_version],
    ["Cover letter", job.cover_letter],
    ["Contact", job.contact],
  ];
  return (
    <div className="max-w-3xl">
      <Link href="/list" className="text-sm text-muted">← All jobs</Link>
      <PageTitle title={job.company} sub={job.role}>
        <Link href={`/jobs/${job.id}?edit=1`} className="btn">Edit</Link>
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusChip status={job.status} /> <ByClaude by={job.added_by} /> <JobMeta job={job} />
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="card p-4">
            {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mb-3 block break-all text-sm font-semibold text-accent">Open job post ↗</a>}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="text-xs font-semibold text-muted">{k}</dt><dd className="break-words">{v}</dd></div>
              ))}
            </dl>
            {job.notes && <p className="mt-4 whitespace-pre-wrap border-t border-line pt-3 text-sm">{job.notes}</p>}
          </div>
          <section className="card p-4">
            <h2 className="mb-3 font-bold">History</h2>
            <NoteForm id={job.id} />
            <ol className="mt-4 space-y-3">
              {events.map((e) => (
                <li key={e.id} className="border-l-2 border-line pl-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {eventText(e)} <ByClaude by={e.by} />
                    <span className="text-xs font-normal text-muted">{fmtDate(e.at)}</span>
                  </div>
                  {e.text && <p className="whitespace-pre-wrap text-sm">{e.text}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="space-y-4">
          <div className="card p-4"><StatusPicker id={job.id} status={job.status} /></div>
          <DeleteButton id={job.id} />
        </aside>
      </div>
    </div>
  );
}
