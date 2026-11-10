import { z } from "zod";

export const STATUSES = [
  "saved",
  "applied",
  "interview",
  "offer",
  "rejected",
  "ghosted",
  "withdrawn",
] as const;
export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
export const YES_NO = ["yes", "no", "unknown"] as const;
export const EVENT_KINDS = ["created", "status_change", "note", "interview"] as const;
export const ACTORS = ["me", "claude"] as const;

export type Status = (typeof STATUSES)[number];
export type Actor = (typeof ACTORS)[number];

export const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
};

// Empty strings from forms become "not set".
const optText = z
  .string()
  .trim()
  .max(5000)
  .nullish()
  .transform((v) => (v ? v : null));
const optDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD");
const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" ? null : v), z.enum(values).nullish()).transform((v) => v ?? null);

export const jobFields = {
  company: z.string().trim().min(1, "Company is required").max(200),
  role: z.string().trim().min(1, "Role is required").max(200),
  url: optText,
  country: optText,
  work_mode: optEnum(WORK_MODES),
  relocation: z.enum(YES_NO).default("unknown"),
  visa_support: z.enum(YES_NO).default("unknown"),
  status: z.enum(STATUSES).default("saved"),
  source: optText,
  salary_text: optText,
  applied_on: optDate,
  follow_up_on: optDate,
  cv_version: optText,
  cover_letter: optText,
  contact: optText,
  notes: optText,
};

export const JobInput = z.object(jobFields);
export type JobInput = z.input<typeof JobInput>;

// For edits: every field optional, status is changed through setStatus instead.
export const JobPatch = z
  .object({
    company: jobFields.company.optional(),
    role: jobFields.role.optional(),
    url: optText.optional(),
    country: optText.optional(),
    work_mode: optEnum(WORK_MODES).optional(),
    relocation: z.enum(YES_NO).optional(),
    visa_support: z.enum(YES_NO).optional(),
    source: optText.optional(),
    salary_text: optText.optional(),
    applied_on: optDate.optional(),
    follow_up_on: optDate.optional(),
    cv_version: optText.optional(),
    cover_letter: optText.optional(),
    contact: optText.optional(),
    notes: optText.optional(),
  })
  .strict();
export type JobPatch = z.input<typeof JobPatch>;

export type Job = {
  id: string;
  company: string;
  role: string;
  url: string | null;
  country: string | null;
  work_mode: (typeof WORK_MODES)[number] | null;
  relocation: (typeof YES_NO)[number];
  visa_support: (typeof YES_NO)[number];
  status: Status;
  source: string | null;
  salary_text: string | null;
  applied_on: string | null;
  follow_up_on: string | null;
  cv_version: string | null;
  cover_letter: string | null;
  contact: string | null;
  notes: string | null;
  added_by: Actor;
  created_at: string;
  updated_at: string;
};

export type JobEvent = {
  id: string;
  job_id: string;
  kind: (typeof EVENT_KINDS)[number];
  from_status: Status | null;
  to_status: Status | null;
  text: string | null;
  at: string;
  by: Actor;
};
