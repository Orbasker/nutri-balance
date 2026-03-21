import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { FoodEditor } from "@/components/admin/food-editor";

import { getAdminFoodDetail, getAllNutrients } from "../actions";

export default async function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [food, allNutrients] = await Promise.all([getAdminFoodDetail(id), getAllNutrients()]);

  if (!food) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/foods"
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to foods
        </Link>
      </div>
      <h2 className="mb-4 text-lg font-semibold">Edit: {food.name}</h2>
      <FoodEditor food={food} allNutrients={allNutrients} />
    </div>
  );
}
