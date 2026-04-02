import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { platformAccounts } from "@/lib/db/schema/platform-accounts";
import { substances as substancesTable } from "@/lib/db/schema/substances";
import { profiles, userSubstanceLimits } from "@/lib/db/schema/users";

type PlatformAccount = typeof platformAccounts.$inferSelect;

interface SubstanceEntry {
  name: string;
  key: string;
}

interface OnboardingData {
  substances?: SubstanceEntry[];
  currentIndex?: number;
  healthGoal?: string;
}

const NUTRIENT_PRESETS: Record<string, SubstanceEntry[]> = {
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
 * States: new -> awaiting_name -> awaiting_goals -> awaiting_substances -> awaiting_limits -> complete
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
        "Welcome to NutriBalance! I help you track substances and answer 'Can I eat this today?'\n\n" +
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
    case "awaiting_substances":
      await handleAwaitingSubstances(account, messageText, respond);
      break;
    case "awaiting_limits":
      await handleAwaitingLimits(account, messageText, respond);
      break;
    default:
      console.error(`[NutriBalance Bot] Unexpected onboarding state: ${account.onboardingState}`);
      await updateOnboardingState(account.id, "new", null);
      await respond(
        "Something went wrong. Let's restart your setup.\n\n" +
          "Welcome to NutriBalance! I help you track substances and answer 'Can I eat this today?'\n\n" +
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
    "Welcome to NutriBalance! I help you track substances and answer 'Can I eat this today?'\n\n" +
      "What's your name?",
  );
}

/**
 * Extract the actual name from natural language input.
 * Handles patterns like "My name is X", "I'm X", "It's X", "call me X", or just "X".
 */
function extractName(text: string): string {
  const trimmed = text.trim();
  // Match common patterns and extract the name part
  const patterns = [
    /^(?:my name is|i'm|im|i am|it's|its|they call me|call me|you can call me)\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1].trim();
  }
  return trimmed;
}

async function handleAwaitingName(
  account: PlatformAccount,
  messageText: string,
  respond: (text: string) => Promise<unknown>,
) {
  const name = extractName(messageText);

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

  await updateOnboardingState(account.id, "awaiting_substances", { healthGoal: goal });
  await respond(
    "Got it! Now let's set up which substances to track.\n\n" +
      "Pick a preset or choose custom:\n" +
      "1. Kidney health (Potassium, Sodium)\n" +
      "2. Blood thinner (Vitamin K)\n" +
      "3. General tracking (all available substances)\n" +
      "4. Custom (pick individually)\n\n" +
      "Reply with a number (1-4):",
  );
}

async function handleAwaitingSubstances(
  account: PlatformAccount,
  messageText: string,
  respond: (text: string) => Promise<unknown>,
) {
  const data = account.onboardingData as OnboardingData | null;
  const choice = messageText.trim();

  // Handle re-entry after custom selection (option "4")
  if (data?.currentIndex === -1 && data.substances && data.substances.length > 0) {
    const numbers = choice.split(",").map((s) => parseInt(s.trim(), 10));

    const allValid =
      numbers.length > 0 && numbers.every((n) => n >= 1 && n <= data.substances!.length);

    if (!allValid) {
      const substanceList = data.substances.map((n, i) => `${i + 1}. ${n.name}`).join("\n");
      await respond(
        `Please enter valid numbers between 1 and ${data.substances.length}, separated by commas.\n\n` +
          substanceList,
      );
      return;
    }

    const selectedSubstances = numbers.map((n) => data.substances![n - 1]);

    await updateOnboardingState(account.id, "awaiting_limits", {
      substances: selectedSubstances,
      currentIndex: 0,
    });

    await respond(
      `You selected: ${selectedSubstances.map((n) => n.name).join(", ")}.\n\n` +
        `Now let's set your daily limits. What's your daily limit for ${selectedSubstances[0].name}? (in mg)`,
    );
    return;
  }

  if (choice === "4") {
    // Custom selection - fetch available substances from DB
    const availableSubstances = await db
      .select({
        id: substancesTable.id,
        displayName: substancesTable.displayName,
        unit: substancesTable.unit,
      })
      .from(substancesTable)
      .orderBy(substancesTable.sortOrder);

    const substanceList = availableSubstances
      .map((n, i: number) => `${i + 1}. ${n.displayName} (${n.unit})`)
      .join("\n");

    const substanceEntries = availableSubstances.map((n) => ({
      name: n.displayName,
      key: n.id,
    }));

    await updateOnboardingState(account.id, "awaiting_substances", {
      substances: substanceEntries,
      currentIndex: -1, // waiting for custom selection
    });

    await respond(
      "Which substances would you like to track? Reply with the numbers separated by commas:\n\n" +
        substanceList,
    );
    return;
  }

  const preset = NUTRIENT_PRESETS[choice];
  if (!preset) {
    await respond("Please reply with a number between 1 and 4.");
    return;
  }

  await updateOnboardingState(account.id, "awaiting_limits", {
    substances: preset,
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
  const data = (account.onboardingData as OnboardingData) ?? { substances: [], currentIndex: 0 };
  const substances = data.substances ?? [];
  const currentIndex = data.currentIndex ?? 0;

  if (substances.length === 0) {
    await updateOnboardingState(account.id, "complete", null);
    await respond("Onboarding is complete! You can now ask me about foods and nutrition.");
    return;
  }

  const limitValue = parseFloat(messageText.trim());
  if (isNaN(limitValue) || limitValue <= 0) {
    await respond(
      `Please enter a valid number for your ${substances[currentIndex].name} daily limit (in mg).`,
    );
    return;
  }

  // Look up the substance in the database
  const currentSubstance = substances[currentIndex];
  const substanceRows = await db
    .select({
      id: substancesTable.id,
      displayName: substancesTable.displayName,
      unit: substancesTable.unit,
    })
    .from(substancesTable)
    .orderBy(substancesTable.sortOrder);

  const matchedSubstance = substanceRows.find(
    (n) =>
      n.displayName.toLowerCase() === currentSubstance.name.toLowerCase() ||
      n.id === currentSubstance.key,
  );

  if (matchedSubstance) {
    // Save the substance limit
    await db.insert(userSubstanceLimits).values({
      userId: account.userId,
      substanceId: matchedSubstance.id,
      dailyLimit: String(limitValue),
      mode: "strict",
    });
  }

  const nextIndex = currentIndex + 1;

  if (nextIndex >= substances.length) {
    // All limits configured
    await updateOnboardingState(account.id, "complete", null);
    await respond(
      "Onboarding is complete! You're all set.\n\n" +
        "Try asking me: 'Can I eat pizza today?' or 'What's my daily summary?'",
    );
  } else {
    // Ask for next substance limit
    await updateOnboardingState(account.id, "awaiting_limits", {
      ...data,
      currentIndex: nextIndex,
    });
    await respond(`Got it! What's your daily limit for ${substances[nextIndex].name}? (in mg)`);
  }
}
