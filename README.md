# Job Tracker

A personal job application tracker that works on phone and laptop.
The app has no AI inside. Claude connects to it through an MCP server, so it can add and update jobs from chat.

## What is in here

| Part | Where | What it does |
| --- | --- | --- |
| Shared core | `lib/jobs.ts` | All job rules. The app and the MCP tools both call it. |
| Field checks | `lib/schema.ts` | Zod schemas for every field |
| MCP server | `lib/mcp.ts`, `app/api/mcp/route.ts` | 10 tools for Claude, protected by a secret token |
| Screens | `app/(app)/` | Today, Board, List, Companies, Job detail, Stats, Add job |
| Database | `supabase/migrations/0001_init.sql` | Two tables: `jobs` and `job_events` |
| Keep-alive | `.github/workflows/keep-alive.yml` | Daily ping so the free database is not paused |
| Company shortlist | `lib/companies.ts`, `app/(app)/companies` | Companies to follow; the table is created automatically on first use |
| Tests | `tests/` | Tests for the rules, run against an in-memory Postgres |

## MCP tools

`add_job`, `find_jobs`, `get_job`, `update_job`, `set_status`, `add_note`, `due_followups`, `get_stats`, `shortlist_company`, `list_shortlisted_companies`.
There is no delete tool: only you can delete, from the app.

## Rules the tracker follows

- The same link is never saved twice. Adding it again returns the existing job.
- The first time a job leaves **Saved**, `applied_on` is set to today.
- Moving to **Applied** sets a follow-up 7 days later (if none is set).
- Closing a job (offer, rejected, ghosted, withdrawn) clears the follow-up.
- Everything Claude writes is tagged "by Claude" in the app.

## Set up (about 15 minutes, all free)

### 1. Database (Supabase)

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`, and run it.
3. Open **Connect** and copy the **Transaction pooler** connection string (port 6543). Put your database password into it. This is `DATABASE_URL`.

### 2. App (Vercel)

1. Import this repo at vercel.com.
2. Add these environment variables:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | The connection string from step 1 |
| `APP_PASSWORD` | The password you will type to open the app |
| `SESSION_SECRET` | Long random text, e.g. from `openssl rand -hex 32` |
| `MCP_TOKEN` | Another long random text (24+ characters) |
| `APP_TIMEZONE` | `Asia/Dhaka` |

3. Deploy. Open the site, log in, and add a job to check it works.
4. On your phone, open the site and choose **Add to Home screen**.

### 3. Connect Claude

In Claude, open **Settings > Connectors > Add custom connector** and use this URL:

```
https://YOUR-APP.vercel.app/api/mcp?key=YOUR_MCP_TOKEN
```

Then ask Claude: "Add this job to my tracker" and paste a job post.

Treat that URL like a password. To change it, change `MCP_TOKEN` in Vercel and redeploy.

### 4. Keep the database awake

The workflow pings this app's live address. If the address changes, set the repository variable `APP_URL` (**Settings > Secrets and variables > Actions > Variables**) to the new one.
The workflow then calls `/api/health` once a day.

## Run on your own computer

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
npm test
```
