import { FoodReviewGrid } from "@/components/admin/food-review-grid";

import { getPendingFoods } from "./actions";

export default async function FoodsReviewPage() {
  const foods = await getPendingFoods();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Food Review</h2>
        <p className="text-sm text-muted-foreground">
          Review, approve, or delete foods and their substance data.
        </p>
      </div>
      <FoodReviewGrid foods={foods} />
    </div>
  );
}
