import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../lib/db";
import * as jobs from "../lib/jobs";

let db: Db;
let pg: PGlite;

beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  db = { query: async (text, params) => (await pg.query(text, params as unknown[])).rows as never };
});

const base = { company: "Acme", role: "Backend Engineer" };

describe("addJob", () => {
  it("creates a saved job with a created event", async () => {
    const { job, duplicate } = await jobs.addJob(db, { ...base, url: "https://acme.dev/jobs/1" }, "claude");
    expect(duplicate).toBe(false);
    expect(job.status).toBe("saved");
    expect(job.added_by).toBe("claude");
    expect(job.applied_on).toBeNull();
    const { events } = await jobs.getJob(db, job.id);
    expect(events.map((e) => e.kind)).toEqual(["created"]);
    expect(events[0].by).toBe("claude");
  });

  it("returns the existing job when the link is already tracked", async () => {
    const a = await jobs.addJob(db, { ...base, url: "https://acme.dev/jobs/1?utm_source=x#top" }, "me");
    const b = await jobs.addJob(db, { company: "Acme Inc", role: "Other", url: "https://acme.dev/jobs/1/" }, "claude");
    expect(b.duplicate).toBe(true);
    expect(b.job.id).toBe(a.job.id);
    expect((await jobs.findJobs(db)).length).toBe(1);
  });

  it("allows many jobs without a link", async () => {
    await jobs.addJob(db, base, "me");
    await jobs.addJob(db, base, "me");
    expect((await jobs.findJobs(db)).length).toBe(2);
  });

  it("rejects a missing company", async () => {
    await expect(jobs.addJob(db, { company: " ", role: "x" }, "me")).rejects.toThrow();
  });

  it("sets applied_on and follow-up when added as applied", async () => {
    const day = await jobs.today(db);
    const { job } = await jobs.addJob(db, { ...base, status: "applied" }, "me");
    expect(job.applied_on).toBe(day);
    expect(job.follow_up_on).toBe(jobs.addDays(day, 7));
  });
});

describe("setStatus", () => {
  it("sets applied_on and a follow-up one week later", async () => {
    const { job } = await jobs.addJob(db, base, "me");
    const day = await jobs.today(db);
    const after = await jobs.setStatus(db, job.id, "applied", "sent via site", "claude");
    expect(after.status).toBe("applied");
    expect(after.applied_on).toBe(day);
    expect(after.follow_up_on).toBe(jobs.addDays(day, 7));
    const { events } = await jobs.getJob(db, job.id);
    const change = events.find((e) => e.kind === "status_change")!;
    expect(change).toMatchObject({ from_status: "saved", to_status: "applied", text: "sent via site", by: "claude" });
  });

  it("keeps the original applied_on on later moves and clears follow-up when closed", async () => {
    const { job } = await jobs.addJob(db, { ...base, status: "applied", applied_on: "2026-01-05" }, "me");
    const i = await jobs.setStatus(db, job.id, "interview", null, "me");
    expect(i.applied_on).toBe("2026-01-05");
    expect(i.follow_up_on).not.toBeNull();
    const r = await jobs.setStatus(db, job.id, "rejected", null, "me");
    expect(r.applied_on).toBe("2026-01-05");
    expect(r.follow_up_on).toBeNull();
  });

  it("does not log a change when the status is the same", async () => {
    const { job } = await jobs.addJob(db, base, "me");
    await jobs.setStatus(db, job.id, "saved", null, "me");
    const { events } = await jobs.getJob(db, job.id);
    expect(events.length).toBe(1);
  });

  it("fails for an unknown job or status", async () => {
    await expect(jobs.setStatus(db, "00000000-0000-0000-0000-000000000000", "applied", null, "me")).rejects.toThrow(jobs.NotFoundError);
    await expect(jobs.setStatus(db, "not-an-id", "applied", null, "me")).rejects.toThrow(jobs.NotFoundError);
    const { job } = await jobs.addJob(db, base, "me");
    await expect(jobs.setStatus(db, job.id, "hired" as never, null, "me")).rejects.toThrow();
  });
});

describe("updateJob and notes", () => {
  it("changes only the given fields and can clear a field", async () => {
    const { job } = await jobs.addJob(db, { ...base, country: "Germany", contact: "Ana" }, "me");
    const u = await jobs.updateJob(db, job.id, { salary_text: "€70k", contact: "" }, "claude");
    expect(u.salary_text).toBe("€70k");
    expect(u.contact).toBeNull();
    expect(u.country).toBe("Germany");
  });

  it("refuses unknown fields such as status", async () => {
    const { job } = await jobs.addJob(db, base, "me");
    await expect(jobs.updateJob(db, job.id, { status: "offer" } as never, "me")).rejects.toThrow();
  });

  it("adds notes to the history", async () => {
    const { job } = await jobs.addJob(db, base, "me");
    await jobs.addNote(db, job.id, "Round 1 on Monday", "interview", "claude");
    const { events } = await jobs.getJob(db, job.id);
    expect(events.some((e) => e.kind === "interview" && e.text === "Round 1 on Monday")).toBe(true);
  });
});

describe("findJobs", () => {
  it("filters by text, status and country", async () => {
    await jobs.addJob(db, { company: "Acme", role: "Backend", country: "Germany" }, "me");
    await jobs.addJob(db, { company: "Globex", role: "Platform", country: "Japan", status: "applied" }, "me");
    expect((await jobs.findJobs(db, { text: "acm" })).map((j) => j.company)).toEqual(["Acme"]);
    expect((await jobs.findJobs(db, { status: "applied" })).map((j) => j.company)).toEqual(["Globex"]);
    expect((await jobs.findJobs(db, { country: "japan" })).length).toBe(1);
    expect((await jobs.findJobs(db, { text: "100%" })).length).toBe(0);
  });
});

describe("dueFollowups", () => {
  it("lists due follow-ups, interviews and stale saved jobs", async () => {
    const day = await jobs.today(db);
    const due = await jobs.addJob(db, { company: "Due", role: "r", status: "applied", follow_up_on: jobs.addDays(day, -1) }, "me");
    await jobs.addJob(db, { company: "Later", role: "r", status: "applied", follow_up_on: jobs.addDays(day, 5) }, "me");
    const closed = await jobs.addJob(db, { company: "Closed", role: "r", status: "applied", follow_up_on: day }, "me");
    await jobs.setStatus(db, closed.job.id, "rejected", null, "me");
    const stale = await jobs.addJob(db, { company: "Stale", role: "r" }, "me");
    await pg.query(`update jobs set created_at = now() - interval '5 days' where id = $1`, [stale.job.id]);
    const iv = await jobs.addJob(db, { company: "Talk", role: "r", status: "interview" }, "me");

    const t = await jobs.dueFollowups(db);
    expect(t.followups.map((j) => j.id)).toEqual([due.job.id]);
    expect(t.interviews.map((j) => j.id)).toEqual([iv.job.id]);
    expect(t.stale_saved.map((j) => j.company)).toEqual(["Stale"]);
    expect((await jobs.dueFollowups(db, 7)).followups.length).toBe(2);
  });
});

describe("getStats", () => {
  it("counts statuses and the reply rate", async () => {
    await jobs.addJob(db, { company: "A", role: "r" }, "me"); // saved
    await jobs.addJob(db, { company: "B", role: "r", status: "applied", country: "Germany" }, "me");
    await jobs.addJob(db, { company: "C", role: "r", status: "interview", country: "Germany" }, "me");
    await jobs.addJob(db, { company: "D", role: "r", status: "rejected", country: "Japan" }, "me");
    await jobs.addJob(db, { company: "E", role: "r", status: "ghosted", country: "Japan" }, "me");
    const s = await jobs.getStats(db);
    expect(s.total).toBe(5);
    expect(s.by_status.saved).toBe(1);
    expect(s.applied_total).toBe(4); // B, C, D, E
    expect(s.replied_total).toBe(2); // C, D
    expect(s.reply_rate_percent).toBe(50); // 2 / 4 * 100
    expect(s.top_countries).toEqual([
      { country: "Germany", applied: 2, replied: 1 },
      { country: "Japan", applied: 2, replied: 1 },
    ]);
    expect(s.applied_per_week.reduce((a, w) => a + w.applied, 0)).toBe(4);
    const none = await jobs.getStats(db, { from: "2099-01-01" });
    expect(none.total).toBe(0);
    expect(none.reply_rate_percent).toBeNull();
  });
});

describe("deleteJob", () => {
  it("removes the job and its history", async () => {
    const { job } = await jobs.addJob(db, base, "me");
    await jobs.deleteJob(db, job.id);
    await expect(jobs.getJob(db, job.id)).rejects.toThrow(jobs.NotFoundError);
    expect((await pg.query(`select 1 from job_events`)).rows.length).toBe(0);
  });
});
