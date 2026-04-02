import Link from "next/link";

interface SourceItem {
  name: string;
  type: string;
  url: string | null;
  trustLevel: number;
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  government_db: { label: "Government Database", icon: "verified" },
  scientific_paper: { label: "Scientific Paper", icon: "science" },
  industry: { label: "Industry", icon: "factory" },
  user_submission: { label: "Community", icon: "group" },
  ai_generated: { label: "AI-Researched", icon: "auto_awesome" },
};

function trustColor(level: number) {
  if (level >= 80) return "bg-emerald-500";
  if (level >= 60) return "bg-blue-500";
  if (level >= 40) return "bg-amber-500";
  return "bg-red-400";
}

export function TrustedSources({ sources }: { sources: SourceItem[] }) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="font-bold text-lg text-md-on-surface mb-1">Trusted Sources</h3>
        <p className="text-sm text-md-on-surface-variant">
          These are the data sources behind the nutritional values you see in the app. Each source
          has a trust level that affects confidence scores.
        </p>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-md-outline-variant/40 p-8 text-center">
          <p className="text-sm text-md-on-surface-variant">No data sources registered yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => {
            const typeInfo = TYPE_LABELS[source.type] ?? {
              label: source.type,
              icon: "database",
            };

            return (
              <div
                key={source.name}
                className="rounded-2xl bg-md-surface-container-low p-4 flex items-start gap-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-md-primary-fixed">
                  <span className="material-symbols-outlined text-[18px] text-md-on-primary-fixed-variant">
                    {typeInfo.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-md-on-surface truncate">
                      {source.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-md-surface-container-high px-2 py-0.5 text-[11px] font-medium text-md-on-surface-variant">
                      {typeInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 rounded-full bg-md-surface-container-high overflow-hidden">
                        <div
                          className={`h-full rounded-full ${trustColor(source.trustLevel)}`}
                          style={{ width: `${source.trustLevel}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-md-outline tabular-nums">
                        Trust: {source.trustLevel}
                      </span>
                    </div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-md-primary hover:underline truncate"
                      >
                        {new URL(source.url).hostname}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <Link
          href="/methodology"
          className="inline-flex items-center gap-1 text-sm font-medium text-md-primary hover:opacity-80 transition-opacity"
        >
          <span className="material-symbols-outlined text-[16px]">info</span>
          How we source and verify data
        </Link>
      </div>
    </section>
  );
}
