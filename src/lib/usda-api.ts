/**
 * USDA FoodData Central API client.
 * Free API — works with DEMO_KEY or a registered key from https://fdc.nal.usda.gov/api-key-signup
 *
 * This fetches REAL measured nutrient data, not LLM-generated estimates.
 */

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

function getApiKey(): string {
  return process.env.USDA_API_KEY ?? "DEMO_KEY";
}

export interface USDAFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

export interface USDAFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodCategory?: string;
  foodNutrients: USDAFoodNutrient[];
}

export interface USDASearchResponse {
  totalHits: number;
  foods: USDAFood[];
}

/**
 * Search USDA FoodData Central for foods containing a specific nutrient.
 * Returns up to `pageSize` foods sorted by the nutrient's value descending.
 */
export async function searchFoodsByNutrient(
  nutrientName: string,
  opts: { pageSize?: number; pageNumber?: number } = {},
): Promise<USDASearchResponse> {
  const { pageSize = 50, pageNumber = 1 } = opts;
  const apiKey = getApiKey();

  // Search for common foods, sorted by the nutrient
  const params = new URLSearchParams({
    api_key: apiKey,
    query: "*",
    dataType: "SR Legacy,Foundation",
    pageSize: String(pageSize),
    pageNumber: String(pageNumber),
    sortBy: "dataType.keyword",
    sortOrder: "asc",
  });

  // USDA nutrient numbers for common nutrients we track
  const nutrientNumber = mapNutrientNameToUSDANumber(nutrientName);
  if (nutrientNumber) {
    params.set("sortBy", `nutrientNumber_${nutrientNumber}`);
    params.set("sortOrder", "desc");
  }

  return fetchWithRetry(`${USDA_BASE}/foods/search?${params}`);
}

/**
 * Search USDA for a specific food by name and get its full nutrient profile.
 */
export async function searchFoodByName(
  foodName: string,
  opts: { pageSize?: number } = {},
): Promise<USDASearchResponse> {
  const { pageSize = 5 } = opts;
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    api_key: apiKey,
    query: foodName,
    dataType: "SR Legacy,Foundation",
    pageSize: String(pageSize),
  });

  return fetchWithRetry(`${USDA_BASE}/foods/search?${params}`);
}

/**
 * Get detailed nutrient data for a specific USDA food by its FDC ID.
 */
export async function getFoodDetails(fdcId: number): Promise<USDAFood> {
  const apiKey = getApiKey();
  return fetchWithRetry(`${USDA_BASE}/food/${fdcId}?api_key=${apiKey}`);
}

/**
 * Fetch with retry and exponential backoff for rate-limited APIs.
 * DEMO_KEY allows 30 req/hour, so 429s are common.
 */
async function fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      return response.json();
    }

    if (response.status === 429 && attempt < maxRetries) {
      // Exponential backoff: 2s, 4s, 8s
      const delay = 2000 * Math.pow(2, attempt);
      console.warn(
        `USDA API rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    throw new Error(`USDA API error: ${response.status} ${response.statusText}`);
  }

  throw new Error("USDA API: max retries exceeded");
}

/**
 * Map our internal nutrient display names to USDA nutrient numbers.
 * See: https://fdc.nal.usda.gov/api-guide
 */
function mapNutrientNameToUSDANumber(name: string): string | null {
  const lower = name.toLowerCase().trim();
  const map: Record<string, string> = {
    // Vitamins
    "vitamin a": "320",
    "vitamin b1": "404",
    thiamin: "404",
    "vitamin b2": "405",
    riboflavin: "405",
    "vitamin b3": "406",
    niacin: "406",
    "vitamin b5": "410",
    "pantothenic acid": "410",
    "vitamin b6": "415",
    "vitamin b9": "417",
    folate: "417",
    "vitamin b12": "418",
    "vitamin c": "401",
    "vitamin d": "328",
    "vitamin e": "323",
    "vitamin k": "430",
    "vitamin k1": "430",
    // Minerals
    calcium: "301",
    iron: "303",
    magnesium: "304",
    phosphorus: "305",
    potassium: "306",
    sodium: "307",
    zinc: "309",
    copper: "312",
    manganese: "315",
    selenium: "317",
    // Macros
    protein: "203",
    fat: "204",
    "total fat": "204",
    carbohydrate: "205",
    carbohydrates: "205",
    fiber: "291",
    "dietary fiber": "291",
    sugar: "269",
    "total sugars": "269",
    // Other
    cholesterol: "601",
    caffeine: "262",
    oxalate: "999", // not in USDA standard
  };
  return map[lower] ?? null;
}

/**
 * Map USDA unit names to our standard units.
 */
export function normalizeUSDAUnit(usdaUnit: string): string {
  const map: Record<string, string> = {
    UG: "mcg",
    MG: "mg",
    G: "g",
    KCAL: "kcal",
    IU: "IU",
    µg: "mcg",
  };
  return map[usdaUnit.toUpperCase()] ?? usdaUnit.toLowerCase();
}

/**
 * Extract a clean food name from USDA description.
 * USDA names look like "Spinach, raw" — we extract "Spinach".
 */
export function cleanUSDAFoodName(description: string): string {
  // Take the part before the first comma
  const base = description.split(",")[0].trim();
  // Capitalize first letter
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Detect preparation method from USDA description.
 */
export function detectPrepMethod(
  description: string,
):
  | "raw"
  | "boiled"
  | "steamed"
  | "grilled"
  | "baked"
  | "fried"
  | "roasted"
  | "sauteed"
  | "poached"
  | "blanched"
  | "drained" {
  const lower = description.toLowerCase();
  if (lower.includes("boiled") || lower.includes("cooked")) return "boiled";
  if (lower.includes("steamed")) return "steamed";
  if (lower.includes("grilled")) return "grilled";
  if (lower.includes("baked")) return "baked";
  if (lower.includes("fried")) return "fried";
  if (lower.includes("roasted")) return "roasted";
  if (lower.includes("sauteed") || lower.includes("sautéed")) return "sauteed";
  if (lower.includes("poached")) return "poached";
  if (lower.includes("blanched")) return "blanched";
  if (lower.includes("drained")) return "drained";
  return "raw";
}
