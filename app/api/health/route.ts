import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Called once a day by GitHub Actions so the free Supabase project stays awake.
export async function GET() {
  try {
    await getDb().query("select 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
