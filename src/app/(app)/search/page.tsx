import { SearchInput } from "@/components/food/search-input";

export default function SearchPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Food Search</h1>
        <p className="text-sm text-muted-foreground">
          Search for foods to check their nutrient content and track your intake.
        </p>
      </div>
      <SearchInput />
    </div>
  );
}
