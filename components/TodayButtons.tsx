"use client";
import { useTransition } from "react";
import { moveFollowUpAction, setStatusAction } from "@/app/actions";

export function FollowUpButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
      <button className="btn btn-sm btn-primary" disabled={pending} title="Mark as followed up and remind again in 7 days"
        onClick={() => start(() => moveFollowUpAction(id, 7))}>Done, +7 days</button>
      <button className="btn btn-sm" disabled={pending} title="Remove the reminder"
        onClick={() => start(() => moveFollowUpAction(id, null))}>Clear</button>
    </div>
  );
}

export function MarkAppliedButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-sm btn-primary shrink-0" disabled={pending} title="Move this job to Applied"
      onClick={() => start(async () => { await setStatusAction(id, "applied"); })}>Mark applied</button>
  );
}
