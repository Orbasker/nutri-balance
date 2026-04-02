import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { getDataSourcesOverview } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  government_db: "Government DB",
  scientific_paper: "Scientific Paper",
  industry: "Industry",
  user_submission: "User Submission",
  ai_generated: "AI Generated",
};

const DERIVATION_LABELS: Record<string, string> = {
  analytical: "Analytical",
  calculated: "Calculated",
  estimated: "Estimated",
  imputed: "Imputed",
  ai_extracted: "AI-Extracted",
};

const REVIEW_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  needs_revision: "bg-blue-100 text-blue-800",
};

export default async function DataSourcesPage() {
  const data = await getDataSourcesOverview();

  if (!data) {
    redirect("/dashboard");
  }

  const { sources, stats } = data;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Data Sources & Pipeline</h2>
        <p className="text-sm text-muted-foreground">
          Overview of registered data sources, observation pipeline health, and confidence metrics.
        </p>
      </div>

      {/* Top-level stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sources</CardDescription>
            <CardTitle className="text-2xl">{stats.totalSources}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Observations</CardDescription>
            <CardTitle className="text-2xl">{stats.totalObservations}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resolved Values</CardDescription>
            <CardTitle className="text-2xl">{stats.totalResolved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Confidence</CardDescription>
            <CardTitle className="text-2xl">{stats.avgConfidence}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Pipeline breakdowns */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* By Source Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sources by Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.sourcesByType.length === 0 && (
              <p className="text-sm text-muted-foreground">No sources registered.</p>
            )}
            {stats.sourcesByType.map((row) => (
              <div key={row.type} className="flex items-center justify-between">
                <span className="text-sm">{TYPE_LABELS[row.type] ?? row.type}</span>
                <Badge variant="secondary">{row.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By Derivation Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observations by Derivation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.observationsByDerivation.length === 0 && (
              <p className="text-sm text-muted-foreground">No observations yet.</p>
            )}
            {stats.observationsByDerivation.map((row) => (
              <div key={row.derivationType} className="flex items-center justify-between">
                <span className="text-sm">
                  {DERIVATION_LABELS[row.derivationType] ?? row.derivationType}
                </span>
                <Badge variant="secondary">{row.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By Review Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.observationsByReviewStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">No observations yet.</p>
            )}
            {stats.observationsByReviewStatus.map((row) => (
              <div key={row.reviewStatus} className="flex items-center justify-between">
                <span className="text-sm capitalize">{row.reviewStatus.replace("_", " ")}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    REVIEW_STATUS_COLORS[row.reviewStatus] ?? "bg-gray-100 text-gray-800"
                  }`}
                >
                  {row.count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered Sources</CardTitle>
          <CardDescription>
            All data sources with their type, trust level, and observation count.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No data sources registered yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Trust</th>
                    <th className="pb-2 pr-4 font-medium text-right">Observations</th>
                    <th className="pb-2 font-medium">URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sources.map((source) => (
                    <tr key={source.id}>
                      <td className="py-2.5 pr-4 font-medium">{source.name}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="outline">{TYPE_LABELS[source.type] ?? source.type}</Badge>
                      </td>
                      <td className="py-2.5 pr-4">
                        <TrustBar value={source.trustLevel} />
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {source.observationCount}
                      </td>
                      <td className="py-2.5 max-w-[200px] truncate text-muted-foreground">
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground transition-colors"
                          >
                            {source.url}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrustBar({ value }: { value: number }) {
  const color =
    value >= 80
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-blue-500"
        : value >= 40
          ? "bg-amber-500"
          : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}
