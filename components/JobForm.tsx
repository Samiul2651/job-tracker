"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { FormState } from "@/app/actions";
import { STATUSES, STATUS_LABEL, WORK_MODES, YES_NO, type Job } from "@/lib/schema";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Field({ name, label, job, type = "text", required, placeholder }: {
  name: keyof Job; label: string; job?: Job; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" required={required} placeholder={placeholder}
        defaultValue={(job?.[name] as string | null) ?? ""} />
    </div>
  );
}

function Select({ name, label, options, value, blank }: {
  name: string; label: string; options: readonly string[]; value?: string | null; blank?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" defaultValue={value ?? (blank ? "" : options[0])}>
        {blank && <option value="">Not set</option>}
        {options.map((o) => (
          <option key={o} value={o}>{name === "status" ? STATUS_LABEL[o as keyof typeof STATUS_LABEL] : o}</option>
        ))}
      </select>
    </div>
  );
}

export function JobForm({ action, job, cancelHref }: { action: Action; job?: Job; cancelHref: string }) {
  const [state, setState] = useState<FormState>(undefined);
  const [pending, start] = useTransition();
  // Submitted by hand (not through the form's action) so the fields keep
  // what you typed when saving fails.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => setState(await action(undefined, data)));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field name="url" label="Link to the job post" job={job} type="url" placeholder="https://" /></div>
        <Field name="company" label="Company" job={job} required />
        <Field name="role" label="Role" job={job} required />
        {!job && <Select name="status" label="Status" options={STATUSES} />}
        <Field name="country" label="Country" job={job} placeholder="Germany, Japan, Remote…" />
        <Select name="work_mode" label="Work mode" options={WORK_MODES} value={job?.work_mode} blank />
        <Select name="relocation" label="Relocation support" options={YES_NO} value={job?.relocation ?? "unknown"} />
        <Select name="visa_support" label="Visa support" options={YES_NO} value={job?.visa_support ?? "unknown"} />
        <Field name="source" label="Where you found it" job={job} placeholder="LinkedIn, referral…" />
        <Field name="salary_text" label="Salary (as written)" job={job} />
      </div>
      <details className="card p-4" open={!!job}>
        <summary className="cursor-pointer text-sm font-semibold">More details</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="applied_on" label="Applied on" job={job} type="date" />
          <Field name="follow_up_on" label="Follow up on" job={job} type="date" />
          <Field name="cv_version" label="CV version" job={job} />
          <Field name="cover_letter" label="Cover letter" job={job} />
          <div className="sm:col-span-2"><Field name="contact" label="Contact person" job={job} /></div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={4} className="input" defaultValue={job?.notes ?? ""} />
          </div>
        </div>
      </details>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <Link href={cancelHref} className="btn">Cancel</Link>
      </div>
    </form>
  );
}
