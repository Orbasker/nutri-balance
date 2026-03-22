"use client";

import Link from "next/link";

export function LandingPage() {
  return (
    <>
      <div className="flex min-h-screen flex-col">
        {/* Nav */}
        <header className="fixed top-0 z-40 w-full border-b border-md-outline-variant/20 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
            <h1 className="font-heading text-xl font-extrabold tracking-tight text-md-primary">
              NutriBalance
            </h1>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[0.8rem] font-medium transition-all hover:bg-muted hover:text-foreground"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-7 items-center justify-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-all hover:bg-primary/80"
              >
                Get started
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1">
          <section className="relative overflow-hidden px-6 pb-20 pt-32">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-md-primary-fixed/20 to-transparent" />
            <div className="relative mx-auto max-w-screen-md text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-md-primary-fixed/40 px-4 py-1.5 text-sm font-medium text-md-on-primary-fixed-variant">
                <span className="material-symbols-outlined text-[18px]">vital_signs</span>
                Medical-grade nutrient tracking
              </div>
              <h2 className="mb-6 font-heading text-4xl font-extrabold leading-tight tracking-tight text-md-on-surface sm:text-5xl">
                Can I eat this today?
              </h2>
              <p className="mx-auto mb-10 max-w-lg text-lg text-md-on-surface-variant">
                Track nutrient intake against your medical limits. Get confidence scores, cooking
                adjustments, and clear answers — not guesswork.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
                >
                  Start tracking free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground"
                >
                  Log in
                </Link>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="px-6 py-20">
            <div className="mx-auto max-w-screen-lg">
              <h3 className="mb-12 text-center font-heading text-2xl font-extrabold tracking-tight text-md-on-surface">
                Built for people with dietary constraints
              </h3>
              <div className="grid gap-8 sm:grid-cols-3">
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
          <section className="px-6 py-20">
            <div className="glass-card mx-auto max-w-screen-sm rounded-3xl border border-md-outline-variant/20 p-10 text-center">
              <h3 className="mb-3 font-heading text-2xl font-extrabold tracking-tight text-md-on-surface">
                Take control of your nutrition
              </h3>
              <p className="mb-8 text-md-on-surface-variant">
                Free to use. Set up your limits in minutes.
              </p>
              <Link
                href="/register"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
              >
                Create your account
              </Link>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-md-outline-variant/20 px-6 py-8">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between text-sm text-md-on-surface-variant">
            <span className="font-semibold text-md-primary">NutriBalance</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </>
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
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-md-primary-fixed">
        <span className="material-symbols-outlined text-[20px] text-md-on-primary-fixed-variant">
          {icon}
        </span>
      </div>
      <h4 className="mb-1 font-bold text-md-on-surface">{title}</h4>
      <p className="text-sm leading-relaxed text-md-on-surface-variant">{description}</p>
    </div>
  );
}
