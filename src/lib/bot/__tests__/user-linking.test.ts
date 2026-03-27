import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { findOrCreatePlatformAccount } from "../user-linking";

// Mock dependencies before importing
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/db/schema/auth", () => ({
  user: {
    id: "id",
    name: "name",
    email: "email",
    emailVerified: "email_verified",
  },
}));

vi.mock("@/lib/db/schema/platform-accounts", () => ({
  platformAccounts: {
    id: "id",
    userId: "user_id",
    platform: "platform",
    platformUserId: "platform_user_id",
    platformUsername: "platform_username",
    onboardingState: "onboarding_state",
    onboardingData: "onboarding_data",
    createdAt: "created_at",
  },
}));

vi.mock("@/lib/db/schema/users", () => ({
  profiles: {
    id: "id",
    displayName: "display_name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
}));

describe("findOrCreatePlatformAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns existing account when platform + platformUserId match", async () => {
    const existingAccount = {
      id: "acc-123",
      userId: "user-456",
      platform: "telegram" as const,
      platformUserId: "tg-789",
      platformUsername: "testuser",
      onboardingState: "complete" as const,
      onboardingData: null,
      createdAt: new Date(),
    };

    const mockWhere = vi.fn().mockResolvedValue([existingAccount]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

    const result = await findOrCreatePlatformAccount("telegram", "tg-789", "testuser");

    expect(result).toEqual(existingAccount);
  });

  it("creates new auth user, profile, and platform account when not found", async () => {
    // First select returns empty (no existing account)
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

    // Platform account insert
    const newAccount = {
      id: "new-acc-id",
      userId: "new-user-id",
      platform: "telegram" as const,
      platformUserId: "tg-999",
      platformUsername: "newuser",
      onboardingState: "new" as const,
      onboardingData: null,
      createdAt: new Date(),
    };

    // db.insert called three times: auth user, profile, platform account
    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never) // auth user
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never) // profile
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newAccount]),
        }),
      } as never); // platform account

    const result = await findOrCreatePlatformAccount("telegram", "tg-999", "newuser");

    expect(result).toEqual(newAccount);
    // Should have inserted auth user, profile, then platform account
    expect(db.insert).toHaveBeenCalledTimes(3);
  });

  it("uses 'Bot User' as display name when platformUsername is null", async () => {
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

    const newAccount = {
      id: "new-acc-id",
      userId: "new-user-id",
      platform: "telegram" as const,
      platformUserId: "tg-000",
      platformUsername: null,
      onboardingState: "new" as const,
      onboardingData: null,
      createdAt: new Date(),
    };

    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newAccount]),
        }),
      } as never);

    const result = await findOrCreatePlatformAccount("telegram", "tg-000", null);

    expect(result).toEqual(newAccount);
  });

  it("recovers from concurrent creation (unique constraint violation)", async () => {
    // First select: not found
    const mockWhere = vi.fn().mockResolvedValueOnce([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

    const existingAccount = {
      id: "acc-concurrent",
      userId: "user-concurrent",
      platform: "telegram" as const,
      platformUserId: "tg-race",
      platformUsername: "racer",
      onboardingState: "new" as const,
      onboardingData: null,
      createdAt: new Date(),
    };

    // Auth user insert fails with unique constraint
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi
        .fn()
        .mockRejectedValue(new Error("duplicate key value violates unique constraint")),
    } as never);

    // On retry select, account is found
    mockWhere.mockResolvedValueOnce([existingAccount]);

    const result = await findOrCreatePlatformAccount("telegram", "tg-race", "racer");

    expect(result).toEqual(existingAccount);
  });
});
