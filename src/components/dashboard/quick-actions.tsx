import Link from "next/link";

import { ClipboardListIcon, SearchIcon, SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="lg" render={<Link href="/search" />}>
        <SearchIcon data-icon="inline-start" />
        Search Food
      </Button>
      <Button variant="outline" size="lg" render={<Link href="/log" />}>
        <ClipboardListIcon data-icon="inline-start" />
        View Log
      </Button>
      <Button variant="outline" size="lg" render={<Link href="/settings" />}>
        <SettingsIcon data-icon="inline-start" />
        Settings
      </Button>
    </div>
  );
}
