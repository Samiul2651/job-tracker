"use client";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setStatusAction } from "@/app/actions";
import { STATUSES, STATUS_LABEL, type Job, type Status } from "@/lib/schema";

function CardBody({ job }: { job: Job }) {
  return (
    <>
      <div className="font-semibold leading-snug">{job.company}</div>
      <div className="text-sm leading-snug">{job.role}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted">
        {job.country && <span>{job.country}</span>}
        {job.added_by === "claude" && <span className="chip chip-accent">by Claude</span>}
      </div>
    </>
  );
}

function Card({ job, onMove }: { job: Job; onMove: (id: string, s: Status) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`card relative p-3 touch-manipulation select-none ${isDragging ? "opacity-40" : ""}`}>
      <Link href={`/jobs/${job.id}`} draggable={false} className="block"><CardBody job={job} /></Link>
      <label className="sr-only" htmlFor={`move-${job.id}`}>Move {job.company}</label>
      <select id={`move-${job.id}`} value={job.status} onChange={(e) => onMove(job.id, e.target.value as Status)}
        onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
        className="mt-2 block w-full max-w-full truncate rounded-md border border-line bg-surface px-1 py-1 text-xs text-muted">
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
    </div>
  );
}

function Column({ status, jobs, onMove }: { status: Status; jobs: Job[]; onMove: (id: string, s: Status) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} aria-label={STATUS_LABEL[status]}
      className={`flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-xl border p-2 md:w-64 ${isOver ? "border-accent bg-accent-soft" : "border-line"}`}>
      <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-bold">
        {STATUS_LABEL[status]} <span className="chip">{jobs.length}</span>
      </h2>
      <div className="flex min-h-24 flex-col gap-2">
        {jobs.map((j) => <Card key={j.id} job={j} onMove={onMove} />)}
      </div>
    </section>
  );
}

export function Board({ jobs: saved }: { jobs: Job[] }) {
  // Show the move at once; if the save fails, the card goes back by itself.
  const [jobs, moveNow] = useOptimistic(saved, (list, m: { id: string; status: Status }) =>
    list.map((j) => (j.id === m.id ? { ...j, status: m.status } : j)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  // Mouse: drag after moving 6px. Touch: long-press, so swiping still scrolls the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function move(id: string, status: Status) {
    const job = jobs.find((j) => j.id === id);
    if (!job || job.status === status) return;
    setError(null);
    start(async () => {
      moveNow({ id, status });
      const res = await setStatusAction(id, status);
      if (res?.error) setError(res.error);
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    if (e.over) move(String(e.active.id), e.over.id as Status);
  }

  const dragging = jobs.find((j) => j.id === dragId);
  return (
    <>
      {error && <p role="alert" className="mb-2 text-sm text-bad">{error}</p>}
      <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
          {STATUSES.map((s) => <Column key={s} status={s} jobs={jobs.filter((j) => j.status === s)} onMove={move} />)}
        </div>
        <DragOverlay>{dragging ? <div className="card p-3 shadow-xl"><CardBody job={dragging} /></div> : null}</DragOverlay>
      </DndContext>
    </>
  );
}
