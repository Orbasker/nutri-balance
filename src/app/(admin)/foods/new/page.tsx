import { FoodForm } from "@/components/admin/food-form";

export default function NewFoodPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Add New Food</h2>
      <div className="max-w-lg">
        <FoodForm mode="create" />
      </div>
    </div>
  );
}
