import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

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
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <Link
          href="/search"
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to search
        </Link>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold">{food.name}</h1>
        {food.category && <p className="text-muted-foreground text-sm">{food.category}</p>}
        {food.description && (
          <p className="text-muted-foreground mt-1 text-sm">{food.description}</p>
        )}
      </div>

      <FoodDetailClient food={food} todaysConsumption={todaysConsumption} userLimits={userLimits} />
    </div>
  );
}
