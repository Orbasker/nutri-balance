import { SearchInput } from "@/components/food/search-input";

import { createClient } from "@/lib/supabase/server";

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let firstName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, display_name")
      .eq("id", user.id)
      .single();
    firstName = profile?.first_name ?? profile?.display_name?.split(/\s+/)[0] ?? null;
  }

  return (
    <div className="px-6 max-w-screen-xl mx-auto">
      {/* Hero Search Section */}
      <section className="mt-8 mb-12">
        <h2 className="text-3xl font-extrabold text-md-primary mb-2 tracking-tight">
          {firstName ? `What are you eating, ${firstName}?` : "What are you eating?"}
        </h2>
        <p className="text-md-on-surface-variant font-medium">
          Search any food to check its nutrients against your limits.
        </p>
        <div className="mt-8">
          <SearchInput />
        </div>
      </section>
    </div>
  );
}
