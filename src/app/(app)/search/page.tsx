import { eq } from "drizzle-orm";

import { SearchInput } from "@/components/food/search-input";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";

export default async function SearchPage() {
  const session = await getSession();

  let firstName: string | null = null;
  if (session) {
    const [profile] = await db
      .select({ firstName: profiles.firstName, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, session.user.id));
    firstName = profile?.firstName ?? profile?.displayName?.split(/\s+/)[0] ?? null;
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
