import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

import { findOrCreatePlatformAccount } from "../user-linking";

// Mock dependencies before importing
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
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
  const mockSupabase = {
    auth: {
      admin: {
        createUser: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);
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
    expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("creates new auth user, profile, and platform account when not found", async () => {
    // First select returns empty (no existing account)
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

    // Auth user creation
    mockSupabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-user-id" } },
      error: null,
    });

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

    // db.insert called twice: once for profiles, once for platform_accounts
    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newAccount]),
        }),
      } as never);

    const result = await findOrCreatePlatformAccount("telegram", "tg-999", "newuser");

    expect(result).toEqual(newAccount);
    expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith({
      email: "telegram_tg-999@bot.nutribalance.local",
      email_confirm: true,
    });
  });

  it("uses 'Bot User' as display name when platformUsername is null", async () => {
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

    mockSupabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-user-id" } },
      error: null,
    });

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

    // Auth creation succeeds
    mockSupabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-user-race" } },
      error: null,
    });

    // Profile insert succeeds, but platform account insert fails (unique constraint)
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

    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never) // profile insert ok
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockRejectedValue(new Error("duplicate key value violates unique constraint")),
        }),
      } as never); // platform account insert fails

    // On retry select, account is found (created by concurrent request)
    mockWhere.mockResolvedValueOnce([existingAccount]);

    const result = await findOrCreatePlatformAccount("telegram", "tg-race", "racer");

    expect(result).toEqual(existingAccount);
  });
});
