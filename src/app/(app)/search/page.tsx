import { SearchInput } from "@/components/food/search-input";

export default function SearchPage() {
  return (
    <div className="px-6 max-w-screen-xl mx-auto">
      {/* Hero Search Section */}
      <section className="mt-8 mb-12">
        <h2 className="text-3xl font-extrabold text-md-primary mb-2 tracking-tight">
          Explore Food
        </h2>
        <p className="text-md-on-surface-variant font-medium">
          Identify nutrients in your daily meals.
        </p>
        <div className="mt-8">
          <SearchInput />
        </div>
      </section>
    </div>
  );
}
