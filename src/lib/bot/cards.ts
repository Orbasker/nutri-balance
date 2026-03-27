import { Card, CardText, Divider } from "chat";

interface TrackedNutrient {
  nutrient: string;
  unit: string;
  consumedToday: number;
  adding: number;
  newTotal: number;
  dailyLimit: number | null;
  percentOfLimit: number | null;
  status: "safe" | "caution" | "exceed";
}

interface CanIEatResult {
  food: string;
  preparationMethod: string;
  portionGrams: number;
  overallVerdict: "safe" | "caution" | "exceed";
  trackedNutrients: TrackedNutrient[];
}

interface DailySummaryResult {
  nutrients: Array<{
    nutrient: string;
    unit: string;
    consumed: number;
    dailyLimit: number | null;
    percentOfLimit: number | null;
    status: "safe" | "caution" | "exceed";
  }>;
  mealsLogged: number;
}

interface FoodSearchResult {
  id: string;
  name: string;
  category: string;
}

interface MealLoggedResult {
  food: string;
  portionGrams: number;
  mealLabel?: string;
  nutrients: Array<{
    nutrient: string;
    unit: string;
    amount: number;
  }>;
}

const VERDICT_EMOJI: Record<string, string> = {
  safe: "\u2705",
  caution: "\u26A0\uFE0F",
  exceed: "\u274C",
};

const STATUS_ICON: Record<string, string> = {
  safe: "\uD83D\uDFE2",
  caution: "\uD83D\uDFE1",
  exceed: "\uD83D\uDD34",
};

/**
 * Format a "Can I eat this?" result as a rich card.
 */
export function formatCanIEatCard(result: CanIEatResult) {
  const verdictEmoji = VERDICT_EMOJI[result.overallVerdict] ?? "";
  const title = `${verdictEmoji} ${result.food} (${result.preparationMethod}, ${result.portionGrams}g)`;

  const nutrientLines = result.trackedNutrients.map((n) => {
    const icon = STATUS_ICON[n.status] ?? "";
    const limitStr = n.dailyLimit != null ? `/${n.dailyLimit}` : "";
    const pctStr = n.percentOfLimit != null ? ` (${n.percentOfLimit}%)` : "";
    return `${icon} **${n.nutrient}**: +${n.adding}${n.unit} \u2192 ${n.newTotal}${limitStr}${n.unit}${pctStr}`;
  });

  return Card({
    title,
    children: [
      CardText(`**Verdict: ${result.overallVerdict.toUpperCase()}**`),
      Divider(),
      CardText(nutrientLines.join("\n")),
    ],
  });
}

/**
 * Format a daily summary as a rich card.
 */
export function formatDailySummaryCard(summary: DailySummaryResult) {
  const nutrientLines = summary.nutrients.map((n) => {
    const icon = STATUS_ICON[n.status] ?? "";
    const limitStr = n.dailyLimit != null ? `/${n.dailyLimit}` : "";
    const pctStr = n.percentOfLimit != null ? ` (${n.percentOfLimit}%)` : "";
    return `${icon} **${n.nutrient}**: ${n.consumed}${limitStr}${n.unit}${pctStr}`;
  });

  return Card({
    title: "\uD83D\uDCCA Daily Summary",
    children: [
      CardText(`**${summary.mealsLogged} meals logged today**`),
      Divider(),
      CardText(nutrientLines.join("\n")),
    ],
  });
}

/**
 * Format food search results as a rich card with web links.
 */
export function formatFoodSearchCard(foods: FoodSearchResult[], appUrl: string) {
  if (foods.length === 0) {
    return Card({
      title: "\uD83D\uDD0D Search Results",
      children: [CardText("No foods found matching your search.")],
    });
  }

  const foodItems = foods.map((f) =>
    CardText(`\u2022 **${f.name}** (${f.category}) \u2014 [View details](${appUrl}/food/${f.id})`),
  );

  return Card({
    title: `\uD83D\uDD0D Found ${foods.length} result${foods.length === 1 ? "" : "s"}`,
    children: foodItems,
  });
}

/**
 * Format a meal logged confirmation as a rich card.
 */
export function formatMealLoggedCard(result: MealLoggedResult) {
  const mealStr = result.mealLabel ? ` (${result.mealLabel})` : "";
  const nutrientLines = result.nutrients
    .map((n) => `\u2022 ${n.nutrient}: +${n.amount}${n.unit}`)
    .join("\n");

  return Card({
    title: `\u2705 Logged: ${result.food} \u2014 ${result.portionGrams}g${mealStr}`,
    children: [CardText(`**Nutrient impact:**\n${nutrientLines}`)],
  });
}
