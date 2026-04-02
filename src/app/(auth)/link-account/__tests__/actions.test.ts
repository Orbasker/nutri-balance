import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockDbSelectWhere = vi.fn();
const mockDbUpdateWhere = vi.fn();
const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));
const mockOpenDM = vi.fn();
const mockPostMessage = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/bot", () => ({
  getBot: vi.fn(() => ({
    getAdapter: vi.fn(() => ({
      openDM: mockOpenDM,
      postMessage: mockPostMessage,
    })),
  })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: mockDbSelectWhere,
        })),
      })),
    })),
    update: mockDbUpdate,
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  ne: vi.fn(),
}));

vi.mock("@/lib/db/schema/account-link-tokens", () => ({
  accountLinkTokens: {
    id: "id",
    platformAccountId: "platform_account_id",
    expiresAt: "expires_at",
    usedAt: "used_at",
    token: "token",
    status: "status",
  },
}));

vi.mock("@/lib/db/schema/platform-accounts", () => ({
  platformAccounts: {
    id: "id",
    userId: "user_id",
    platform: "platform",
    platformUserId: "platform_user_id",
    platformUsername: "platform_username",
  },
}));

vi.mock("@/lib/db/schema/auth", () => ({
  user: {},
}));

vi.mock("@/lib/db/schema/users", () => ({
  consumptionLogs: {},
  profiles: {},
  userSubstanceLimits: {},
}));

describe("linkAccountToWeb notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSession.mockResolvedValue({
      user: { id: "web-user-1" },
    });
    mockDbSelectWhere.mockResolvedValue([
      {
        tokenId: "token-row-1",
        platformAccountId: "platform-account-1",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        usedAt: null,
        linkedUserId: "web-user-1",
        platform: "telegram",
        platformUserId: "123456789",
        platformUsername: "or",
      },
    ]);
    mockDbUpdateWhere.mockResolvedValue(undefined);
    mockOpenDM.mockResolvedValue("telegram:123456789");
    mockPostMessage.mockResolvedValue({ id: "msg-1", raw: {} });
  });

  it("sends the link success message through the telegram adapter using the raw platform user id", async () => {
    const { linkAccountToWeb } = await import("../actions");

    const result = await linkAccountToWeb("token-abc");

    expect(result).toEqual({
      success: true,
      platform: "telegram",
      platformUsername: "or",
    });
    expect(mockOpenDM).toHaveBeenCalledWith("123456789");
    expect(mockPostMessage).toHaveBeenCalledWith(
      "telegram:123456789",
      "Your account is already linked to this web account. Your data is already synced between the bot and dashboard.",
    );
  });
});
