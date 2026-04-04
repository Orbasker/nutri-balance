import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { eq } from "drizzle-orm";

import { FeedbackForm } from "@/components/food/feedback-form";

import { getSubstanceReferenceValues } from "@/lib/app-config";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema/foods";

import {
  getFoodDetail,
  getTodaysConsumption,
  getTotalSubstanceCount,
  getUserSubstanceLimits,
} from "./actions";
import { FoodDetailClient } from "./food-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [food] = await db
    .select({ name: foods.name, category: foods.category, description: foods.description })
    .from(foods)
    .where(eq(foods.id, id))
    .limit(1);

  if (!food) return {};

  const title = food.name;
  const description =
    food.description ??
    `Nutritional substance data for ${food.name}${food.category ? ` (${food.category})` : ""} — confidence-scored values with source attribution.`;

  return {
    title,
    description,
    openGraph: {
      title: `${food.name} — NutriBalance`,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${food.name} — NutriBalance`,
      description,
    },
    alternates: {
      canonical: `/food/${id}`,
    },
  };
}

export default async function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [food, todaysConsumption, userLimits, totalSubstanceCount, substanceReferenceValues] =
    await Promise.all([
      getFoodDetail(id),
      getTodaysConsumption(),
      getUserSubstanceLimits(),
      getTotalSubstanceCount(),
      getSubstanceReferenceValues(),
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

      <FoodDetailClient
        food={food}
        totalSubstanceCount={totalSubstanceCount}
        todaysConsumption={todaysConsumption}
        userLimits={userLimits}
        substanceReferenceValues={substanceReferenceValues}
      />

      <FeedbackForm
        foodId={food.id}
        variants={food.variants.map((v) => ({
          id: v.id,
          preparationMethod: v.preparationMethod,
          substances: v.substances.map((n) => ({
            substanceId: n.substanceId,
            displayName: n.displayName,
            unit: n.unit,
          })),
        }))}
      />
    </div>
  );
}
