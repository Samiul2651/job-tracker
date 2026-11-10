// The MCP server: 10 tools that Claude can call. Each one is a thin wrapper
// around lib/jobs.ts and records its writes as done by "claude".
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Db } from "./db";
import * as companies from "./companies";
import * as jobs from "./jobs";
import { STATUSES, WORK_MODES, YES_NO } from "./schema";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const status = z.enum(STATUSES);

const editable = {
  url: z.string().nullable().optional().describe("Link to the job post"),
  country: z.string().nullable().optional().describe("e.g. Germany, Japan, Remote"),
  work_mode: z.enum(WORK_MODES).nullable().optional(),
  relocation: z.enum(YES_NO).optional().describe("Does the employer support relocation?"),
  visa_support: z.enum(YES_NO).optional(),
  source: z.string().nullable().optional().describe("Where the job was found, e.g. LinkedIn, Hidden Job Scout"),
  salary_text: z.string().nullable().optional().describe("Salary as written in the post"),
  applied_on: date.nullable().optional(),
  follow_up_on: date.nullable().optional().describe("Date to follow up; shows in the Today view"),
  cv_version: z.string().nullable().optional(),
  cover_letter: z.string().nullable().optional(),
  contact: z.string().nullable().optional().describe("Recruiter or contact person"),
  notes: z.string().nullable().optional(),
};

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (e) {
    const message =
      e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : e instanceof jobs.NotFoundError ? e.message
      : e instanceof Error && /Unknown status|Note text|Company name/.test(e.message) ? e.message
      : "Something went wrong while talking to the tracker.";
    if (!(e instanceof z.ZodError) && !(e instanceof jobs.NotFoundError)) console.error("[mcp]", e);
    return { isError: true, content: [{ type: "text" as const, text: message }] };
  }
}

export function buildMcpServer(db: Db): McpServer {
  const server = new McpServer({ name: "job-tracker", version: "1.0.0" });

  server.registerTool(
    "add_job",
    {
      title: "Add job",
      description:
        "Save a new job in the tracker. If the same link is already tracked, the existing job is returned with duplicate=true and nothing is created. Call find_jobs first when there is no link.",
      inputSchema: {
        company: z.string().min(1),
        role: z.string().min(1),
        status: status.optional().describe("Defaults to saved"),
        ...editable,
      },
    },
    (args) => run(() => jobs.addJob(db, args, "claude")),
  );

  server.registerTool(
    "find_jobs",
    {
      title: "Find jobs",
      description: "Search tracked jobs. All filters are optional; with none, returns the most recently updated jobs.",
      inputSchema: {
        text: z.string().optional().describe("Matches company, role, notes or link"),
        status: z.array(status).optional(),
        country: z.string().optional(),
        source: z.string().optional(),
        from: date.optional().describe("Added on or after this date"),
        to: date.optional().describe("Added on or before this date"),
        limit: z.number().int().min(1).max(200).optional().describe("Default 50"),
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      run(async () => {
        const list = await jobs.findJobs(db, { ...args, limit: args.limit ?? 50 });
        return { count: list.length, jobs: list };
      }),
  );

  server.registerTool(
    "get_job",
    {
      title: "Get job",
      description: "Get one job with its full history (status changes, notes, interviews).",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    ({ id }) => run(() => jobs.getJob(db, id)),
  );

  server.registerTool(
    "update_job",
    {
      title: "Update job",
      description: "Change fields of a job. Only the fields you pass are changed; pass null to clear one. To change the status use set_status.",
      inputSchema: {
        id: z.string(),
        company: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
        ...editable,
      },
    },
    ({ id, ...patch }) => run(() => jobs.updateJob(db, id, patch, "claude")),
  );

  server.registerTool(
    "set_status",
    {
      title: "Set status",
      description:
        "Move a job to a new status. Moving to applied sets applied_on to today and a follow-up one week later. Closing a job (offer, rejected, ghosted, withdrawn) clears the follow-up.",
      inputSchema: { id: z.string(), status, note: z.string().optional().describe("Optional note saved with the change") },
    },
    ({ id, status: s, note }) => run(() => jobs.setStatus(db, id, s, note, "claude")),
  );

  server.registerTool(
    "add_note",
    {
      title: "Add note",
      description: "Add a note or an interview entry to a job's history.",
      inputSchema: {
        id: z.string(),
        text: z.string().min(1),
        kind: z.enum(["note", "interview"]).optional().describe("Defaults to note"),
      },
    },
    ({ id, text, kind }) =>
      run(async () => {
        await jobs.addNote(db, id, text, kind ?? "note", "claude");
        return { saved: true };
      }),
  );

  server.registerTool(
    "due_followups",
    {
      title: "Due follow-ups",
      description:
        "What needs attention: follow-ups due today or earlier (or within days_ahead), jobs in the interview stage, and jobs saved more than 3 days ago but not applied to.",
      inputSchema: { days_ahead: z.number().int().min(0).max(60).optional().describe("Default 0 = due today or overdue") },
      annotations: { readOnlyHint: true },
    },
    ({ days_ahead }) => run(() => jobs.dueFollowups(db, days_ahead ?? 0)),
  );

  server.registerTool(
    "get_stats",
    {
      title: "Get stats",
      description:
        "Numbers for the job search: count per status, reply rate (jobs that reached interview, offer or rejected, divided by jobs applied to), top countries, and applications per week.",
      inputSchema: { from: date.optional(), to: date.optional() },
      annotations: { readOnlyHint: true },
    },
    (args) => run(() => jobs.getStats(db, args)),
  );

  server.registerTool(
    "shortlist_company",
    {
      title: "Shortlist company",
      description: "Add a company to the company shortlist (a separate list of companies worth following). Adding one that is already there keeps it and updates the note if given.",
      inputSchema: { name: z.string().min(1), note: z.string().optional().describe("Why it is worth following") },
    },
    ({ name, note }) => run(() => companies.shortlistCompany(db, name, note, "claude")),
  );

  server.registerTool(
    "list_shortlisted_companies",
    {
      title: "List shortlisted companies",
      description: "List the company shortlist, with each company's note and the jobs tracked there.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => run(async () => {
      const list = await companies.listShortlist(db);
      return { count: list.length, companies: list };
    }),
  );

  return server;
}
