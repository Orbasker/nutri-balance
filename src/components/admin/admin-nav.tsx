"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/ai-runs", label: "AI Runs" },
  { href: "/foods", label: "Foods" },
  { href: "/review", label: "Review Queue" },
  { href: "/ai-observations", label: "AI Items" },
  { href: "/foods-review", label: "Food Review" },
  { href: "/admin-settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            pathname.startsWith(item.href)
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
