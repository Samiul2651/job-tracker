import { createJobAction } from "@/app/actions";
import { JobForm } from "@/components/JobForm";
import { PageTitle } from "@/components/JobBits";

export default function NewJobPage() {
  return (
    <div className="max-w-2xl">
      <PageTitle title="Add job" sub="Only company and role are required." />
      <JobForm action={createJobAction} cancelHref="/" />
    </div>
  );
}
