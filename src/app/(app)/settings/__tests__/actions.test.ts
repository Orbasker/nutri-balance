import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockRevalidatePath = vi.fn();
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockInsertOnConflictDoUpdate = vi.fn();
const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockInsertOnConflictDoUpdate }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/auth-session", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: mockUpdate,
    insert: mockInsert,
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(() => "eq"),
}));

vi.mock("@/lib/db/schema/users", () => ({
  profiles: { id: "id", clinicalNotes: "clinical_notes" },
  userNutrientLimits: {},
}));

vi.mock("@/lib/db/schema/nutrients", () => ({
  nutrients: {},
}));

vi.mock("@/lib/validators", () => ({
  createCustomNutrientSchema: { safeParse: vi.fn() },
  deleteCustomNutrientSchema: { safeParse: vi.fn() },
  deleteUserNutrientLimitSchema: { safeParse: vi.fn() },
  saveUserNutrientLimitSchema: { safeParse: vi.fn() },
  toUserNutrientLimitRow: vi.fn(),
}));

describe("saveMedicalNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("updates the existing profile row when present", async () => {
    mockUpdateReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    const { saveMedicalNotes } = await import("../actions");
    const result = await saveMedicalNotes({ notes: "Keep vitamin K intake steady" });

    expect(result).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("creates the profile row when the update finds nothing", async () => {
    mockUpdateReturning.mockResolvedValueOnce([]);
    mockInsertOnConflictDoUpdate.mockResolvedValueOnce(undefined);

    const { saveMedicalNotes } = await import("../actions");
    const result = await saveMedicalNotes({ notes: "Avoid potassium spikes" });

    expect(result).toEqual({ ok: true });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith({
      id: "user-1",
      clinicalNotes: "Avoid potassium spikes",
    });
    expect(mockInsertOnConflictDoUpdate).toHaveBeenCalledWith({
      target: "id",
      set: { clinicalNotes: "Avoid potassium spikes" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings");
  });
});
