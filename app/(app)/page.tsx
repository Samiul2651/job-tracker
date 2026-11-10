import { Empty, JobRow, PageTitle } from "@/components/JobBits";
import { FollowUpButtons, MarkAppliedButton } from "@/components/TodayButtons";
import { getDb } from "@/lib/db";
import { dueLabel, fmtDate } from "@/lib/format";
import { STALE_SAVED_DAYS, dueFollowups } from "@/lib/jobs";

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{title} · {count}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default async function TodayPage() {
  const t = await dueFollowups(getDb(), 0);
  const nothing = !t.followups.length && !t.interviews.length && !t.stale_saved.length;
  return (
    <>
      <PageTitle title="Today" sub={fmtDate(t.today)} />
      {nothing && <Empty>Nothing needs your attention today.</Empty>}
      {t.followups.length > 0 && (
        <Section title="Follow up" count={t.followups.length}>
          {t.followups.map((j) => (
            <div key={j.id}>
              <JobRow job={j} right={<FollowUpButtons id={j.id} />} />
              <p className="mt-1 pl-3 text-xs font-semibold text-warn">{dueLabel(t.today, j.follow_up_on!)}</p>
            </div>
          ))}
        </Section>
      )}
      {t.interviews.length > 0 && (
        <Section title="In interviews" count={t.interviews.length}>
          {t.interviews.map((j) => <JobRow key={j.id} job={j} />)}
        </Section>
      )}
      {t.stale_saved.length > 0 && (
        <Section title={`Saved over ${STALE_SAVED_DAYS} days ago, not applied`} count={t.stale_saved.length}>
          {t.stale_saved.map((j) => <JobRow key={j.id} job={j} right={<MarkAppliedButton id={j.id} />} />)}
        </Section>
      )}
    </>
  );
}
