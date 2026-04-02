"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: "home", label: "Home" },
  { href: "/search", icon: "search", label: "Search" },
  { href: "/chat", icon: "chat", label: "Chat" },
  { href: "/log", icon: "history", label: "History" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-64 z-50 flex-col pt-8 pb-8 px-5 bg-white/70 backdrop-blur-xl border-r border-slate-200/60">
        <Link href="/dashboard" className="mb-10 px-3">
          <span className="text-4xl font-extrabold text-blue-800">N</span>
        </Link>
        <div className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-4 h-14 rounded-xl transition-all duration-200 active:scale-[0.98]",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-400 hover:text-blue-600 hover:bg-slate-50",
                )}
              >
                <span
                  className="material-symbols-outlined text-[26px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="text-base font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile: bottom nav */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 pb-safe bg-white/70 backdrop-blur-xl">
        <div className="flex justify-around items-center w-full px-4 h-20">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center px-5 py-2 transition-all duration-200 active:scale-95",
                  isActive
                    ? "bg-blue-50 text-blue-700 rounded-2xl"
                    : "text-slate-400 hover:text-blue-600",
                )}
              >
                <span
                  className="material-symbols-outlined"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
