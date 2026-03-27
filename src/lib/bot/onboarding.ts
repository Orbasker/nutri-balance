import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { nutrients as nutrientsTable } from "@/lib/db/schema/nutrients";
import { platformAccounts } from "@/lib/db/schema/platform-accounts";
import { profiles, userNutrientLimits } from "@/lib/db/schema/users";

type PlatformAccount = typeof platformAccounts.$inferSelect;

interface NutrientEntry {
  name: string;
  key: string;
}

interface OnboardingData {
  nutrients?: NutrientEntry[];
  currentIndex?: number;
  healthGoal?: string;
}

const NUTRIENT_PRESETS: Record<string, NutrientEntry[]> = {
  "1": [
    { name: "Potassium", key: "potassium" },
    { name: "Sodium", key: "sodium" },
  ],
  "2": [{ name: "Vitamin K", key: "vitamin_k" }],
  "3": [
    { name: "Potassium", key: "potassium" },
    { name: "Sodium", key: "sodium" },
    { name: "Vitamin K", key: "vitamin_k" },
    { name: "Phosphorus", key: "phosphorus" },
    { name: "Vitamin C", key: "vitamin_c" },
    { name: "Iron", key: "iron" },
  ],
};

/**
 * Handle onboarding state machine for bot users.
 *
 * States: new -> awaiting_name -> awaiting_goals -> awaiting_nutrients -> awaiting_limits -> complete
 */
export async function handleOnboarding(
  account: PlatformAccount,
  messageText: string,
  respond: (text: string) => Promise<unknown>,
): Promise<void> {
  // Handle restart command from any state
  const trimmed = messageText.trim().toLowerCase();
  if (trimmed === "/restart" || trimmed === "restart") {
    await updateOnboardingState(account.id, "new", null);
    await respond(
      "Onboarding reset! Let's start fresh.\n\n" +
        "Welcome to NutriBalance! I help you track nutrients and answer 'Can I eat this today?'\n\n" +
        "What's your name?",
    );
    return;
  }

  const state = account.onboardingState;

  switch (state) {
    case "new":
      await handleNew(account, respond);
      break;
    case "awaiting_name":
      await handleAwaitingName(account, messageText, respond);
      break;
    case "awaiting_goals":
      await handleAwaitingGoals(account, messageText, respond);
      break;
    case "awaiting_nutrients":
      await handleAwaitingNutrients(account, messageText, respond);
      break;
    case "awaiting_limits":
      await handleAwaitingLimits(account, messageText, respond);
      break;
    default:
      console.error(`[NutriBalance Bot] Unexpected onboarding state: ${account.onboardingState}`);
      await updateOnboardingState(account.id, "new", null);
      await respond(
        "Something went wrong. Let's restart your setup.\n\n" +
          "Welcome to NutriBalance! I help you track nutrients and answer 'Can I eat this today?'\n\n" +
          "What's your name?",
      );
      break;
  }
}

async function updateOnboardingState(
  accountId: string,
  newState: PlatformAccount["onboardingState"],
  data?: OnboardingData | null,
) {
  await db
    .update(platformAccounts)
    .set({
      onboardingState: newState,
      ...(data !== undefined ? { onboardingData: data } : {}),
    })
    .where(eq(platformAccounts.id, accountId));
}

async function handleNew(account: PlatformAccount, respond: (text: string) => Promise<unknown>) {
  await updateOnboardingState(account.id, "awaiting_name");
  await respond(
    "Welcome to NutriBalance! I help you track nutrients and answer 'Can I eat this today?'\n\n" +
      "What's your name?",
  );
}

async function handleAwaitingName(
  account: PlatformAccount,
  messageText: string,
  respond: (text: string) => Promise<unknown>,
) {
  const name = messageText.trim();

  // Save display name to profile
  await db.update(profiles).set({ displayName: name }).where(eq(profiles.id, account.userId));

  await updateOnboardingState(account.id, "awaiting_goals");
  await respond(
    `Nice to meet you, ${name}! What's your health goal or dietary concern?\n\n` +
      "For example: 'Managing kidney disease', 'On blood thinners', or 'General nutrition tracking'",
  );
}

async function handleAwaitingGoals(
  account: PlatformAccount,
  messageText: string,
  respond: (text: string) => Promise<unknown>,
) {
  const goal = messageText.trim();

  // Save health goal and clinical notes to profile
  await db
    .update(profiles)
    .set({ healthGoal: goal, clinicalNotes: goal })
    .where(eq(profiles.id, account.userId));

  await updateOnboardingState(account.id, "awaiting_nutrients", { healthGoal: goal });
  await respond(
    "Got it! Now let's set up which nutrients to track.\n\n" +
      "Pick a preset or choose custom:\n" +
      "1. Kidney health (Potassium, Sodium)\n" +
      "2. Blood thinner (Vitamin K)\n" +
      "3. General tracking (all available nutrients)\n" +
      "4. Custom (pick individually)\n\n" +
      "Reply with a number (1-4):",
  );
}

async function handleAwaitingNutrients(
  account: PlatformAccount,
  messageText: string,
  respond: (text: string) => Promise<unknown>,
) {
  const data = account.onboardingData as OnboardingData | null;
  const choice = messageText.trim();

  // Handle re-entry after custom selection (option "4")
  if (data?.currentIndex === -1 && data.nutrients && data.nutrients.length > 0) {
    const numbers = choice.split(",").map((s) => parseInt(s.trim(), 10));

    const allValid =
      numbers.length > 0 && numbers.every((n) => n >= 1 && n <= data.nutrients!.length);

    if (!allValid) {
      const nutrientList = data.nutrients.map((n, i) => `${i + 1}. ${n.name}`).join("\n");
      await respond(
        `Please enter valid numbers between 1 and ${data.nutrients.length}, separated by commas.\n\n` +
          nutrientList,
      );
      return;
    }

    const selectedNutrients = numbers.map((n) => data.nutrients![n - 1]);

    await updateOnboardingState(account.id, "awaiting_limits", {
      nutrients: selectedNutrients,
      currentIndex: 0,
    });

    await respond(
      `You selected: ${selectedNutrients.map((n) => n.name).join(", ")}.\n\n` +
        `Now let's set your daily limits. What's your daily limit for ${selectedNutrients[0].name}? (in mg)`,
    );
    return;
  }

  if (choice === "4") {
    // Custom selection - fetch available nutrients from DB
    const availableNutrients = await db
      .select({
        id: nutrientsTable.id,
        displayName: nutrientsTable.displayName,
        unit: nutrientsTable.unit,
      })
      .from(nutrientsTable)
      .orderBy(nutrientsTable.sortOrder);

    const nutrientList = availableNutrients
      .map((n, i: number) => `${i + 1}. ${n.displayName} (${n.unit})`)
      .join("\n");

    const nutrientEntries = availableNutrients.map((n) => ({
      name: n.displayName,
      key: n.id,
    }));

    await updateOnboardingState(account.id, "awaiting_nutrients", {
      nutrients: nutrientEntries,
      currentIndex: -1, // waiting for custom selection
    });

    await respond(
      "Which nutrients would you like to track? Reply with the numbers separated by commas:\n\n" +
        nutrientList,
    );
    return;
  }

  const preset = NUTRIENT_PRESETS[choice];
  if (!preset) {
    await respond("Please reply with a number between 1 and 4.");
    return;
  }

  await updateOnboardingState(account.id, "awaiting_limits", {
    nutrients: preset,
    currentIndex: 0,
  });

  await respond(
    `You selected: ${preset.map((n) => n.name).join(", ")}.\n\n` +
      `Now let's set your daily limits. What's your daily limit for ${preset[0].name}? (in mg)`,
  );
}

async function handleAwaitingLimits(
  account: PlatformAccount,
  messageText: string,
  respond: (text: string) => Promise<unknown>,
) {
  const data = (account.onboardingData as OnboardingData) ?? { nutrients: [], currentIndex: 0 };
  const nutrients = data.nutrients ?? [];
  const currentIndex = data.currentIndex ?? 0;

  if (nutrients.length === 0) {
    await updateOnboardingState(account.id, "complete", null);
    await respond("Onboarding is complete! You can now ask me about foods and nutrition.");
    return;
  }

  const limitValue = parseFloat(messageText.trim());
  if (isNaN(limitValue) || limitValue <= 0) {
    await respond(
      `Please enter a valid number for your ${nutrients[currentIndex].name} daily limit (in mg).`,
    );
    return;
  }

  // Look up the nutrient in the database
  const currentNutrient = nutrients[currentIndex];
  const nutrientRows = await db
    .select({
      id: nutrientsTable.id,
      displayName: nutrientsTable.displayName,
      unit: nutrientsTable.unit,
    })
    .from(nutrientsTable)
    .orderBy(nutrientsTable.sortOrder);

  const matchedNutrient = nutrientRows.find(
    (n) =>
      n.displayName.toLowerCase() === currentNutrient.name.toLowerCase() ||
      n.id === currentNutrient.key,
  );

  if (matchedNutrient) {
    // Save the nutrient limit
    await db.insert(userNutrientLimits).values({
      userId: account.userId,
      nutrientId: matchedNutrient.id,
      dailyLimit: String(limitValue),
      mode: "strict",
    });
  }

  const nextIndex = currentIndex + 1;

  if (nextIndex >= nutrients.length) {
    // All limits configured
    await updateOnboardingState(account.id, "complete", null);
    await respond(
      "Onboarding is complete! You're all set.\n\n" +
        "Try asking me: 'Can I eat pizza today?' or 'What's my daily summary?'",
    );
  } else {
    // Ask for next nutrient limit
    await updateOnboardingState(account.id, "awaiting_limits", {
      ...data,
      currentIndex: nextIndex,
    });
    await respond(`Got it! What's your daily limit for ${nutrients[nextIndex].name}? (in mg)`);
  }
}
