import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-md-outline-variant/20">
        <div className="flex justify-between items-center px-6 h-16 max-w-screen-xl mx-auto">
          <h1 className="font-extrabold text-md-primary tracking-tight text-xl">NutriBalance</h1>
          <div className="flex items-center gap-3">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Log in
            </Link>
            <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative pt-32 pb-20 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-md-primary-fixed/20 to-transparent pointer-events-none" />
          <div className="relative max-w-screen-md mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-md-primary-fixed/40 px-4 py-1.5 text-sm font-medium text-md-on-primary-fixed-variant mb-6">
              <span className="material-symbols-outlined text-[18px]">vital_signs</span>
              Medical-grade nutrient tracking
            </div>
            <h2 className="font-extrabold text-4xl sm:text-5xl tracking-tight text-md-on-surface leading-tight mb-6">
              Can I eat this today?
            </h2>
            <p className="text-lg text-md-on-surface-variant max-w-lg mx-auto mb-10">
              Track nutrient intake against your medical limits. Get confidence scores, cooking
              adjustments, and clear answers — not guesswork.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>
                Start tracking free
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Log in
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-6">
          <div className="max-w-screen-lg mx-auto">
            <h3 className="font-extrabold text-2xl text-md-on-surface tracking-tight text-center mb-12">
              Built for people with dietary constraints
            </h3>
            <div className="grid sm:grid-cols-3 gap-8">
              <FeatureCard
                icon="search"
                title="Search any food"
                description="Look up nutrients backed by real data sources. No AI-generated guesses."
              />
              <FeatureCard
                icon="speed"
                title="Confidence scores"
                description="Know how reliable each nutrient value is before you make a decision."
              />
              <FeatureCard
                icon="skillet"
                title="Cooking adjustments"
                description="See how boiling, frying, or baking changes nutrient retention."
              />
              <FeatureCard
                icon="monitoring"
                title="Daily tracking"
                description="Log meals and watch your intake against personal medical limits."
              />
              <FeatureCard
                icon="warning"
                title="Clear thresholds"
                description="Safe, caution, and exceed zones so you never have to guess."
              />
              <FeatureCard
                icon="local_hospital"
                title="Clinical notes"
                description="Store your doctor's dietary instructions right alongside your data."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6">
          <div className="max-w-screen-sm mx-auto text-center glass-card rounded-3xl p-10 border border-md-outline-variant/20">
            <h3 className="font-extrabold text-2xl text-md-on-surface tracking-tight mb-3">
              Take control of your nutrition
            </h3>
            <p className="text-md-on-surface-variant mb-8">
              Free to use. Set up your limits in minutes.
            </p>
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>
              Create your account
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-md-outline-variant/20 py-8 px-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center text-sm text-md-on-surface-variant">
          <span className="font-semibold text-md-primary">NutriBalance</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-md-surface-container-low p-6">
      <div className="w-10 h-10 rounded-xl bg-md-primary-fixed flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-md-on-primary-fixed-variant text-[20px]">
          {icon}
        </span>
      </div>
      <h4 className="font-bold text-md-on-surface mb-1">{title}</h4>
      <p className="text-sm text-md-on-surface-variant leading-relaxed">{description}</p>
    </div>
  );
}
