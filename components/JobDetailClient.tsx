"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { addNoteAction, deleteJobAction, setStatusAction, type FormState } from "@/app/actions";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/schema";

export function StatusPicker({ id, status }: { id: string; status: Status }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label className="label" htmlFor="status">Status</label>
      <select id="status" className="input" value={status} disabled={pending}
        onChange={(e) => start(async () => { const r = await setStatusAction(id, e.target.value); setError(r?.error ?? null); })}>
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      {error && <p role="alert" className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}

export function NoteForm({ id }: { id: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addNoteAction(id, prev, fd);
    if (!res?.error) ref.current?.reset();
    return res;
  }, undefined);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <label className="sr-only" htmlFor="text">Note</label>
      <textarea id="text" name="text" rows={2} className="input" placeholder="Add a note or interview detail" required />
      <div className="flex items-center gap-2">
        <select name="kind" aria-label="Kind" className="input w-auto">
          <option value="note">Note</option>
          <option value="interview">Interview</option>
        </select>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}

export function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) return <button className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>Delete job</button>;
  return (
    <div className="flex items-center gap-2 text-sm">
      Delete this job and its history?
      <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => start(() => deleteJobAction(id))}>Yes, delete</button>
      <button className="btn btn-sm" onClick={() => setConfirming(false)}>Keep</button>
    </div>
  );
}
