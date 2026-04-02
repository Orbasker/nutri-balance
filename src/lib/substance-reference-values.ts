export type SubstanceReferenceValues = Record<string, number>;

export const DEFAULT_SUBSTANCE_REFERENCE_VALUES: SubstanceReferenceValues = {
  energy: 2000,
  protein: 50,
  total_fat: 78,
  saturated_fat: 20,
  cholesterol: 300,
  carbohydrates: 275,
  dietary_fiber: 28,
  sodium: 2300,
  potassium: 4700,
  calcium: 1300,
  iron: 18,
  magnesium: 420,
  phosphorus: 1250,
  zinc: 11,
  copper: 0.9,
  manganese: 2.3,
  selenium: 55,
  iodine: 150,
  chromium: 35,
  molybdenum: 45,
  choline: 550,
  chloride: 2300,
  vitamin_a: 900,
  thiamin: 1.2,
  vitamin_b1: 1.2,
  riboflavin: 1.3,
  vitamin_b2: 1.3,
  niacin: 16,
  vitamin_b3: 16,
  pantothenic_acid: 5,
  vitamin_b5: 5,
  vitamin_b6: 1.7,
  biotin: 30,
  vitamin_b7: 30,
  folate: 400,
  folic_acid: 400,
  vitamin_b12: 2.4,
  vitamin_c: 90,
  vitamin_d: 20,
  vitamin_e: 15,
  vitamin_k: 120,
};

export function normalizeSubstanceReferenceKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function sanitizeSubstanceReferenceValues(value: unknown): SubstanceReferenceValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_SUBSTANCE_REFERENCE_VALUES };
  }

  const sanitized: SubstanceReferenceValues = { ...DEFAULT_SUBSTANCE_REFERENCE_VALUES };

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const parsed =
      typeof rawValue === "number"
        ? rawValue
        : typeof rawValue === "string"
          ? Number(rawValue)
          : NaN;

    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    sanitized[normalizeSubstanceReferenceKey(rawKey)] = parsed;
  }

  return sanitized;
}
