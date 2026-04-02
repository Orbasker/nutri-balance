function getMessageText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }

  if ("text" in message && typeof message.text === "string") {
    return message.text;
  }

  if ("content" in message && typeof message.content === "string") {
    return message.content;
  }

  return "";
}

function readToolInput(toolCall: unknown): Record<string, unknown> | null {
  if (!toolCall || typeof toolCall !== "object") {
    return null;
  }

  if ("input" in toolCall && toolCall.input && typeof toolCall.input === "object") {
    return toolCall.input as Record<string, unknown>;
  }

  if ("args" in toolCall && toolCall.args && typeof toolCall.args === "object") {
    return toolCall.args as Record<string, unknown>;
  }

  return null;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function cleanFoodName(rawFoodName: string): string {
  return rawFoodName
    .trim()
    .replace(/^[`"'“”׳״]+|[`"'“”׳״.,!?;:]+$/g, "")
    .trim();
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

export function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

export function extractFoodResearchRequest(text: string): string | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const patterns = [
    /^(?:ת.?קור|לחקור|חקור)\s+על\s+(.+)$/i,
    /^(?:ת.?קור|לחקור|חקור)\s+את\s+(.+)$/i,
    /^(?:research|look up|investigate)\s+(?:about\s+)?(.+)$/i,
    /^(?:tell me about|find info about)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const foodName = cleanFoodName(match[1] ?? "");
    if (foodName) {
      return foodName;
    }
  }

  return null;
}

export function isResearchConfirmation(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) {
    return false;
  }

  const confirmations = [
    "כן",
    "כן בבקשה",
    "אשמח",
    "אשמח מאוד",
    "בטח",
    "ברור",
    "יאללה",
    "go ahead",
    "please do",
    "yes",
    "yes please",
    "sure",
    "ok",
    "okay",
  ];

  return confirmations.some((value) => normalized === value);
}

export function hasRecentResearchContext(messages: unknown[]): boolean {
  return messages
    .slice(-6)
    .map(getMessageText)
    .some((text) => /\b(?:research|investigate)\b|לחקור|ת.?קור/.test(text));
}

export function findMostRecentResearchFood(messages: unknown[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = getMessageText(messages[index]);
    const foodName = extractFoodResearchRequest(text);
    if (foodName) {
      return foodName;
    }
  }

  return null;
}

export function buildClarifyResearchReply(prefersHebrew: boolean): string {
  return prefersHebrew
    ? "בשמחה. איזה מזון תרצה שאחקור?"
    : "Sure. Which food would you like me to research?";
}

export function buildResearchOutcomeReply(
  foodName: string,
  result: {
    success: boolean;
    error?: string;
    message?: string;
    defaultVariant?: {
      preparationMethod: string;
      nutrients: Array<{
        displayName: string;
        unit: string;
        valuePer100g: number;
      }>;
    };
  },
  prefersHebrew: boolean,
): string {
  if (result.success) {
    const nutrientLines =
      result.defaultVariant?.nutrients
        .slice(0, 6)
        .map(
          (nutrient) =>
            `${nutrient.displayName}: ${formatNumber(nutrient.valuePer100g)} ${nutrient.unit}`,
        ) ?? [];

    const summaryBlock =
      nutrientLines.length > 0
        ? prefersHebrew
          ? `\n\nהנה כמה ערכים ל-100 גרם:\n${nutrientLines.map((line) => `- ${line}`).join("\n")}`
          : `\n\nHere are a few values per 100g:\n${nutrientLines.map((line) => `- ${line}`).join("\n")}`
        : "";

    return prefersHebrew
      ? `חקרתי את "${foodName}" ושמרתי את הנתונים.${summaryBlock}`
      : `I researched "${foodName}" and saved the nutrient data.${summaryBlock}`;
  }

  const errorText = result.error ?? "unknown error";
  return prefersHebrew
    ? `לא הצלחתי להשלים את המחקר על "${foodName}" כרגע. הסיבה: ${errorText}. אפשר לנסות שוב בעוד רגע או לבקש ממני לבדוק אותו מחדש.`
    : `I couldn't finish researching "${foodName}" right now. Reason: ${errorText}. Please try again in a moment or ask me to check it again.`;
}

export function buildGenericErrorReply(prefersHebrew: boolean): string {
  return prefersHebrew
    ? "משהו השתבש בזמן שטיפלתי בבקשה. נסה שוב בעוד רגע."
    : "Something went wrong while handling your request. Please try again in a moment.";
}

export function buildRequestFailureReply(userText: string): string {
  const prefersHebrew = containsHebrew(userText);
  const requestedFood = extractFoodResearchRequest(userText);

  if (requestedFood) {
    return buildResearchOutcomeReply(
      requestedFood,
      { success: false, error: prefersHebrew ? "שגיאת עיבוד זמנית" : "temporary processing error" },
      prefersHebrew,
    );
  }

  return buildGenericErrorReply(prefersHebrew);
}

export function buildToolOnlyReply(args: {
  userText: string;
  toolCall: unknown;
  toolResult: unknown;
}): string | null {
  const prefersHebrew = containsHebrew(args.userText);

  if (!args.toolCall || !args.toolResult || typeof args.toolCall !== "object") {
    return null;
  }

  const toolName =
    "toolName" in args.toolCall && typeof args.toolCall.toolName === "string"
      ? args.toolCall.toolName
      : null;
  const input = readToolInput(args.toolCall);

  if (toolName === "aiResearchFood") {
    const foodName =
      typeof input?.foodName === "string" ? cleanFoodName(input.foodName) : "this food";
    const result =
      typeof args.toolResult === "object" && args.toolResult
        ? (args.toolResult as { success?: boolean; error?: string; message?: string })
        : {};

    if (result.success) {
      return buildResearchOutcomeReply(
        foodName,
        {
          success: true,
          defaultVariant:
            "defaultVariant" in result &&
            result.defaultVariant &&
            typeof result.defaultVariant === "object"
              ? (result.defaultVariant as {
                  preparationMethod: string;
                  nutrients: Array<{
                    displayName: string;
                    unit: string;
                    valuePer100g: number;
                  }>;
                })
              : undefined,
        },
        prefersHebrew,
      );
    }

    if (typeof result.error === "string" && result.error) {
      return buildResearchOutcomeReply(
        foodName,
        { success: false, error: result.error },
        prefersHebrew,
      );
    }
  }

  if (toolName === "searchFood") {
    const searchQuery = typeof input?.query === "string" ? cleanFoodName(input.query) : "that food";
    if (
      typeof args.toolResult === "object" &&
      args.toolResult &&
      "found" in args.toolResult &&
      args.toolResult.found === false
    ) {
      return prefersHebrew
        ? `לא מצאתי תוצאות עבור "${searchQuery}" במאגר. אם תרצה, אפשר לבקש ממני לחקור אותו.`
        : `I couldn't find "${searchQuery}" in the database. If you want, I can research it for you.`;
    }
  }

  return null;
}
