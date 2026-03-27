import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  onboardingStateEnum,
  platformAccountRelations,
  platformAccounts,
  platformEnum,
} from "@/lib/db/schema/platform-accounts";

describe("platform_accounts schema", () => {
  it("exports the platform_accounts table with correct table name", () => {
    expect(getTableName(platformAccounts)).toBe("platform_accounts");
  });

  it("exports platformEnum with correct values", () => {
    expect(platformEnum.enumValues).toEqual(["telegram", "discord"]);
  });

  it("exports onboardingStateEnum with correct values", () => {
    expect(onboardingStateEnum.enumValues).toEqual([
      "new",
      "awaiting_name",
      "awaiting_goals",
      "awaiting_nutrients",
      "awaiting_limits",
      "complete",
    ]);
  });

  it("has required columns defined", () => {
    // Type-level check: these should be non-nullable in the inferred type
    type Row = typeof platformAccounts.$inferSelect;
    type AssertHasId = Row extends { id: string } ? true : never;
    type AssertHasUserId = Row extends { userId: string } ? true : never;
    type AssertHasPlatform = Row extends { platform: string } ? true : never;
    type AssertHasPlatformUserId = Row extends { platformUserId: string } ? true : never;
    type AssertHasOnboardingState = Row extends { onboardingState: string } ? true : never;
    type AssertHasCreatedAt = Row extends { createdAt: Date } ? true : never;

    // Runtime check: column names exist in the table config
    const columnNames = Object.keys(platformAccounts);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("platform");
    expect(columnNames).toContain("platformUserId");
    expect(columnNames).toContain("platformUsername");
    expect(columnNames).toContain("onboardingState");
    expect(columnNames).toContain("onboardingData");
    expect(columnNames).toContain("createdAt");

    // Suppress unused variable warnings
    void (0 as unknown as AssertHasId);
    void (0 as unknown as AssertHasUserId);
    void (0 as unknown as AssertHasPlatform);
    void (0 as unknown as AssertHasPlatformUserId);
    void (0 as unknown as AssertHasOnboardingState);
    void (0 as unknown as AssertHasCreatedAt);
  });

  it("exports relations", () => {
    expect(platformAccountRelations).toBeDefined();
  });
});
