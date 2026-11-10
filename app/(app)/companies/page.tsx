import Link from "next/link";
import { AddCompanyForm, CompanyNote, RemoveCompanyButton } from "@/components/CompanyBits";
import { ByClaude, Empty, PageTitle, StatusChip } from "@/components/JobBits";
import { listShortlist } from "@/lib/companies";
import { getDb } from "@/lib/db";

export default async function CompaniesPage() {
  const companies = await listShortlist(getDb());
  return (
    <>
      <PageTitle title="Company shortlist"
        sub={`${companies.length} compan${companies.length === 1 ? "y" : "ies"}. Shortlist from any job page, or add one here.`} />
      <AddCompanyForm />
      {companies.length === 0 ? (
        <Empty>No companies yet. Open a job and press &ldquo;Shortlist company&rdquo;, or add one above.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {companies.map((c) => (
            <article key={c.id} className="card flex flex-col gap-3 p-4">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
                    <span className="break-words">{c.name}</span> <ByClaude by={c.added_by} />
                  </h2>
                  <p className="text-xs text-muted">
                    {c.jobs.length === 0 ? "No jobs tracked here yet" : `${c.jobs.length} job${c.jobs.length === 1 ? "" : "s"} tracked`}
                  </p>
                </div>
                <RemoveCompanyButton company={c.name} />
              </header>
              <CompanyNote company={c.name} note={c.note} />
              {c.jobs.length > 0 && (
                <ul className="space-y-1 border-t border-line pt-2">
                  {c.jobs.map((j) => (
                    <li key={j.id}>
                      <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm hover:bg-accent-soft">
                        <span className="min-w-0 truncate">{j.role}{j.country ? <span className="text-muted"> · {j.country}</span> : null}</span>
                        <StatusChip status={j.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
