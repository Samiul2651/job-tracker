"use client";
import { useActionState, useOptimistic, useRef, useState, useTransition } from "react";
import { addCompanyAction, saveCompanyNoteAction, setShortlistAction } from "@/app/actions";

/** Star button on the job page: adds or removes the job's company from the shortlist. */
export function ShortlistButton({ company, initial }: { company: string; initial: boolean }) {
  const [on, setOn] = useOptimistic(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button type="button" disabled={pending} aria-pressed={on}
        className={`btn w-full ${on ? "btn-primary" : ""}`}
        onClick={() => start(async () => {
          setOn(!on);
          const r = await setShortlistAction(company, !on);
          setError(r?.error ?? null);
        })}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
        </svg>
        {on ? "Company shortlisted" : "Shortlist company"}
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}

export function RemoveCompanyButton({ company }: { company: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn btn-sm btn-danger" disabled={pending}
      onClick={() => start(async () => { await setShortlistAction(company, false); })}>
      Remove
    </button>
  );
}

export function CompanyNote({ company, note }: { company: string; note: string | null }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveCompanyNoteAction>>, fd: FormData) => {
    const r = await saveCompanyNoteAction(company, prev, fd);
    if (!r?.error) setEditing(false);
    return r;
  }, undefined);
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="block w-full text-left text-sm">
        {note ? <span className="whitespace-pre-wrap">{note}</span> : <span className="text-muted">+ Add a note</span>}
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <label className="sr-only" htmlFor={`note-${company}`}>Note for {company}</label>
      <textarea id={`note-${company}`} name="note" rows={2} className="input" defaultValue={note ?? ""} autoFocus />
      <div className="flex gap-2">
        <button className="btn btn-sm btn-primary" disabled={pending}>Save</button>
        <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}

export function AddCompanyForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof addCompanyAction>>, fd: FormData) => {
    const r = await addCompanyAction(prev, fd);
    if (!r?.error) ref.current?.reset();
    return r;
  }, undefined);
  return (
    <form ref={ref} action={action} className="card mb-4 grid gap-2 p-3 sm:grid-cols-[1fr_2fr_auto]">
      <label className="sr-only" htmlFor="co-name">Company</label>
      <input id="co-name" name="name" className="input" placeholder="Company name" required />
      <label className="sr-only" htmlFor="co-note">Note</label>
      <input id="co-note" name="note" className="input" placeholder="Why you like it (optional)" />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      {state?.error && <p role="alert" className="text-sm text-bad sm:col-span-3">{state.error}</p>}
    </form>
  );
}
