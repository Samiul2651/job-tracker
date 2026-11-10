import { Board } from "@/components/Board";
import { PageTitle } from "@/components/JobBits";
import { getDb } from "@/lib/db";
import { findJobs } from "@/lib/jobs";

export default async function BoardPage() {
  const jobs = await findJobs(getDb(), { limit: 500 });
  return (
    <>
      <PageTitle title="Board" sub="Drag a card to change its status. On a phone, press and hold, or use the menu on the card." />
      <Board jobs={jobs} />
    </>
  );
}
