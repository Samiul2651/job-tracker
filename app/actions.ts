"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SESSION_COOKIE, expectedSession, requireAuth, safeEqual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import * as jobs from "@/lib/jobs";
import { STATUSES, type Status } from "@/lib/schema";

export type FormState = { error?: string } | undefined;

function fields(formData: FormData, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = formData.get(n);
    if (typeof v === "string") out[n] = v;
  }
  return out;
}

const EDITABLE = [
  "company", "role", "url", "country", "work_mode", "relocation", "visa_support", "source",
  "salary_text", "applied_on", "follow_up_on", "cv_version", "cover_letter", "contact", "notes",
];

function errorText(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join(". ");
  if (e instanceof jobs.NotFoundError) return "This job no longer exists.";
  console.error("[action]", e);
  return "Could not save. Please try again.";
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD;
  const session = await expectedSession();
  if (!expected || !session) return { error: "The app is not set up yet: APP_PASSWORD and SESSION_SECRET are missing." };
  if (!safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Wrong password." };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  redirect("/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function createJobAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  let id: string;
  try {
    const res = await jobs.addJob(getDb(), fields(formData, [...EDITABLE, "status"]) as never, "me");
    id = res.job.id;
  } catch (e) {
    return { error: errorText(e) };
  }
  refresh();
  redirect(`/jobs/${id}`);
}

export async function updateJobAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  try {
    await jobs.updateJob(getDb(), id, fields(formData, EDITABLE) as never, "me");
  } catch (e) {
    return { error: errorText(e) };
  }
  refresh();
  redirect(`/jobs/${id}`);
}

export async function setStatusAction(id: string, status: string): Promise<FormState> {
  await requireAuth();
  if (!STATUSES.includes(status as Status)) return { error: "Unknown status." };
  try {
    await jobs.setStatus(getDb(), id, status as Status, null, "me");
  } catch (e) {
    return { error: errorText(e) };
  }
  refresh();
}

export async function addNoteAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const text = String(formData.get("text") ?? "").trim();
  const kind = formData.get("kind") === "interview" ? "interview" : "note";
  if (!text) return { error: "Write something first." };
  try {
    await jobs.addNote(getDb(), id, text, kind, "me");
  } catch (e) {
    return { error: errorText(e) };
  }
  refresh();
}

/** Today view buttons: push the follow-up by N days, or clear it (days = null). */
export async function moveFollowUpAction(id: string, days: number | null): Promise<void> {
  await requireAuth();
  const db = getDb();
  try {
    const follow_up_on = days === null ? null : jobs.addDays(await jobs.today(db), days);
    await jobs.updateJob(db, id, { follow_up_on }, "me");
    if (days !== null) await jobs.addNote(db, id, "Followed up", "note", "me");
  } catch (e) {
    errorText(e);
  }
  refresh();
}

export async function deleteJobAction(id: string): Promise<void> {
  await requireAuth();
  try {
    await jobs.deleteJob(getDb(), id);
  } catch (e) {
    errorText(e);
  }
  refresh();
  redirect("/list");
}
