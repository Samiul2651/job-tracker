import { createJobAction } from "@/app/actions";
import { JobForm } from "@/components/JobForm";
import { PageTitle } from "@/components/JobBits";
import { getDb } from "@/lib/db";
import { listFacets } from "@/lib/jobs";

const PAGES = ["/", "/board", "/list", "/stats"];

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const facets = await listFacets(getDb());
  return (
    <div className="max-w-2xl">
      <PageTitle title="Add job" sub="Only company and role are required." />
      <JobForm action={createJobAction} cancelHref={from && PAGES.includes(from) ? from : "/"}
        usedCountries={facets.countries} usedRoles={facets.roles} />
    </div>
  );
}
