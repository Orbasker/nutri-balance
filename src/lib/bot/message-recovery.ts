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

/**
 * Extract a food name from a bot message that offered to research a food
 * (e.g. `couldn't find "pineapple"` or `"pineapple" isn't in my database`).
 */
export function extractFoodFromBotOffer(text: string): string | null {
  if (!text) return null;

  const patterns = [
    /[""\u201c\u201d]([^""\u201c\u201d]+)[""\u201c\u201d]\s*(?:isn[''\u2019]t|is not)/i,
    /(?:couldn[''\u2019]t find|could not find|no foods? found)[^""\u201c\u201d]*[""\u201c\u201d]([^""\u201c\u201d]+)[""\u201c\u201d]/i,
    /לא מצאתי[^""\u201c\u201d]*[""\u201c\u201d]([^""\u201c\u201d]+)[""\u201c\u201d]/,
    /[""\u201c\u201d]([^""\u201c\u201d]+)[""\u201c\u201d][^""\u201c\u201d]*במאגר/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = cleanFoodName(match[1]);
      if (name) return name;
    }
  }

  return null;
}

/**
 * Scan recent messages for a food name that was offered for research but not yet researched.
 * Looks at bot "not found" messages to find the pending food.
 */
export function findPendingResearchFood(messages: unknown[]): string | null {
  const recent = messages.slice(-6);
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const text = getMessageText(recent[i]);
    const food = extractFoodFromBotOffer(text);
    if (food) return food;
  }
  return null;
}

/**
 * Check if the last bot message is a clarification asking which food to research.
 * This happens when the bot couldn't recover the food name from context.
 */
export function isAwaitingFoodName(messages: unknown[]): boolean {
  if (messages.length === 0) return false;
  const lastText = getMessageText(messages[messages.length - 1]);
  return (
    lastText.includes("Which food would you like me to research?") ||
    lastText.includes("איזה מזון תרצה שאחקור?")
  );
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
      substances: Array<{
        displayName: string;
        unit: string;
        valuePer100g: number;
      }>;
    };
  },
  prefersHebrew: boolean,
): string {
  if (result.success) {
    const substanceLines =
      result.defaultVariant?.substances
        .slice(0, 6)
        .map(
          (substance) =>
            `${substance.displayName}: ${formatNumber(substance.valuePer100g)} ${substance.unit}`,
        ) ?? [];

    const summaryBlock =
      substanceLines.length > 0
        ? prefersHebrew
          ? `\n\nהנה כמה ערכים ל-100 גרם:\n${substanceLines.map((line) => `- ${line}`).join("\n")}`
          : `\n\nHere are a few values per 100g:\n${substanceLines.map((line) => `- ${line}`).join("\n")}`
        : "";

    return prefersHebrew
      ? `חקרתי את "${foodName}" ושמרתי את הנתונים.${summaryBlock}`
      : `I researched "${foodName}" and saved the substance data.${summaryBlock}`;
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
                  substances: Array<{
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
