import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackForm } from "@/components/food/feedback-form";

import { getFoodDetail, getTodaysConsumption, getUserNutrientLimits } from "./actions";
import { FoodDetailClient } from "./food-detail-client";

export default async function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [food, todaysConsumption, userLimits] = await Promise.all([
    getFoodDetail(id),
    getTodaysConsumption(),
    getUserNutrientLimits(),
  ]);

  if (!food) notFound();

  return (
    <div className="pb-32 px-6 max-w-2xl mx-auto space-y-10">
      {/* Back Button */}
      <Link
        href="/search"
        className="inline-flex items-center gap-1 text-md-primary hover:opacity-80 transition-opacity"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        <span className="text-sm font-medium">Back to search</span>
      </Link>

      {/* Hero Section: Food Title & Confidence */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-md-outline">
            {food.category && (
              <>
                <span className="text-xs uppercase tracking-widest font-semibold">
                  {food.category}
                </span>
                <span className="w-1 h-1 rounded-full bg-md-outline-variant" />
              </>
            )}
          </div>
          <h2 className="text-4xl font-extrabold text-md-primary tracking-tight leading-tight">
            {food.name}
          </h2>
          {food.description && (
            <p className="text-md-on-surface-variant text-sm">{food.description}</p>
          )}
        </div>
      </section>

      <FoodDetailClient food={food} todaysConsumption={todaysConsumption} userLimits={userLimits} />

      <FeedbackForm
        foodId={food.id}
        variants={food.variants.map((v) => ({
          id: v.id,
          preparationMethod: v.preparationMethod,
          nutrients: v.nutrients.map((n) => ({
            nutrientId: n.nutrientId,
            displayName: n.displayName,
            unit: n.unit,
          })),
        }))}
      />
    </div>
  );
}
