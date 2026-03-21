import Link from "next/link";

import { Plus } from "lucide-react";

import { FoodList } from "@/components/admin/food-list";
import { Button } from "@/components/ui/button";

import { getAdminFoods } from "./actions";

export default async function AdminFoodsPage() {
  const foods = await getAdminFoods();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Foods</h2>
        <Link href="/foods/new">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Add Food
          </Button>
        </Link>
      </div>
      <FoodList foods={foods} />
    </div>
  );
}
