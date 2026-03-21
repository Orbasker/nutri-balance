import { ReviewQueue } from "@/components/admin/review-queue";

import { getPendingObservations } from "./actions";

export default async function ReviewPage() {
  const observations = await getPendingObservations();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Review Queue</h2>
        <span className="text-muted-foreground text-sm">{observations.length} pending</span>
      </div>
      <ReviewQueue observations={observations} />
    </div>
  );
}
