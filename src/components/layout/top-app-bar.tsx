"use client";

import Link from "next/link";

const avatarColors: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-100", text: "text-blue-700" },
  purple: { bg: "bg-purple-100", text: "text-purple-700" },
  green: { bg: "bg-emerald-100", text: "text-emerald-700" },
  orange: { bg: "bg-orange-100", text: "text-orange-700" },
  pink: { bg: "bg-pink-100", text: "text-pink-700" },
  teal: { bg: "bg-teal-100", text: "text-teal-700" },
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function TopAppBar({
  displayName,
  greeting,
  showAdminLink = false,
  avatarColor = "blue",
}: {
  displayName: string | null;
  greeting: string;
  showAdminLink?: boolean;
  avatarColor?: string;
}) {
  const firstName = displayName?.split(/\s+/)[0] ?? null;
  const initials = displayName ? getInitials(displayName) : null;
  const colors = avatarColors[avatarColor] ?? avatarColors.blue;

  return (
    <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl">
      <div className="flex justify-between items-center px-6 h-16 w-full max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${colors.bg} overflow-hidden flex items-center justify-center`}
            >
              {initials ? (
                <span className={`text-sm font-bold ${colors.text}`}>{initials}</span>
              ) : (
                <span className={`material-symbols-outlined ${colors.text}`}>person</span>
              )}
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-medium text-md-outline">
                {greeting}
                {firstName ? `, ${firstName}` : ""}
              </p>
              <h1 className="font-extrabold text-blue-800 tracking-tight text-lg">NutriBalance</h1>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {showAdminLink && (
            <Link
              href="/ai-observations"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-blue-200 px-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
            >
              Admin
            </Link>
          )}
          <button className="text-blue-700 transition-opacity hover:opacity-80">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </div>
    </header>
  );
}
