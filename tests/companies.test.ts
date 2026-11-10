import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../lib/db";
import * as co from "../lib/companies";
import * as jobs from "../lib/jobs";

let db: Db;

beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  db = { query: async (text, params) => (await pg.query(text, params as unknown[])).rows as never };
});

describe("company shortlist", () => {
  it("creates its table on first use and adds a company once (case-insensitive)", async () => {
    const a = await co.shortlistCompany(db, "  Picnic ", "Good relocation", "me");
    expect(a.created).toBe(true);
    const b = await co.shortlistCompany(db, "picnic", null, "claude");
    expect(b.created).toBe(false);
    const list = await co.listShortlist(db);
    expect(list.map((c) => [c.name, c.note])).toEqual([["Picnic", "Good relocation"]]);
    expect(await co.isShortlisted(db, "PICNIC")).toBe(true);
  });

  it("lists the tracked jobs for each company", async () => {
    await jobs.addJob(db, { company: "Picnic", role: "Java Engineer", status: "applied" }, "me");
    await jobs.addJob(db, { company: "picnic", role: "Store Engineer" }, "me");
    await jobs.addJob(db, { company: "Adyen", role: "Other" }, "me");
    await co.shortlistCompany(db, "Picnic", null, "me");
    await co.shortlistCompany(db, "Mercari", null, "me");
    const list = await co.listShortlist(db);
    expect(list.map((c) => [c.name, c.jobs.length])).toEqual([["Mercari", 0], ["Picnic", 2]]);
  });

  it("updates the note and removes a company", async () => {
    await co.shortlistCompany(db, "Wolt", null, "me");
    await co.updateCompanyNote(db, "wolt", "Covers permit costs");
    expect((await co.listShortlist(db))[0].note).toBe("Covers permit costs");
    expect(await co.unshortlistCompany(db, "WOLT")).toBe(true);
    expect(await co.unshortlistCompany(db, "Wolt")).toBe(false);
    expect(await co.listShortlist(db)).toEqual([]);
  });

  it("rejects an empty name", async () => {
    await expect(co.shortlistCompany(db, "   ", null, "me")).rejects.toThrow();
  });
});
