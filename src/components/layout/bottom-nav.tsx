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

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-white/70 backdrop-blur-xl">
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
  );
}
