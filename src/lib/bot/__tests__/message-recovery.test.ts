import { describe, expect, it } from "vitest";

import {
  buildToolOnlyReply,
  extractFoodResearchRequest,
  findMostRecentResearchFood,
  hasRecentResearchContext,
  isResearchConfirmation,
} from "../message-recovery";

describe("message recovery helpers", () => {
  it("extracts explicit Hebrew food research requests", () => {
    expect(extractFoodResearchRequest("תחקור על אבטיח")).toBe("אבטיח");
    expect(extractFoodResearchRequest("תחקור את מלון")).toBe("מלון");
  });

  it("recognizes short research confirmations", () => {
    expect(isResearchConfirmation("אשמח")).toBe(true);
    expect(isResearchConfirmation("yes please")).toBe(true);
    expect(isResearchConfirmation("maybe later")).toBe(false);
  });

  it("finds recent research context and the latest requested food", () => {
    const messages = [
      { text: "לא מצאתי אותו כרגע. האם תרצה שאחקור אותו באמצעות בינה מלאכותית?" },
      { text: "תחקור על אבטיח" },
      { text: "אשמח" },
    ];

    expect(hasRecentResearchContext(messages)).toBe(true);
    expect(findMostRecentResearchFood(messages)).toBe("אבטיח");
  });

  it("builds a specific fallback reply from tool-only research failures", () => {
    const reply = buildToolOnlyReply({
      userText: "תחקור על אבטיח",
      toolCall: {
        toolName: "aiResearchFood",
        input: { foodName: "אבטיח" },
      },
      toolResult: {
        success: false,
        error: "Provider timeout",
      },
    });

    expect(reply).toContain("אבטיח");
    expect(reply).toContain("Provider timeout");
  });

  it("includes immediate nutrient data when research succeeds", () => {
    const reply = buildToolOnlyReply({
      userText: "check watermelon data",
      toolCall: {
        toolName: "aiResearchFood",
        input: { foodName: "watermelon" },
      },
      toolResult: {
        success: true,
        defaultVariant: {
          preparationMethod: "raw",
          nutrients: [
            { displayName: "Vitamin K", unit: "mcg", valuePer100g: 0.2 },
            { displayName: "Vitamin C", unit: "mg", valuePer100g: 8.1 },
          ],
        },
      },
    });

    expect(reply).toContain("watermelon");
    expect(reply).toContain("Vitamin K: 0.2 mcg");
    expect(reply).toContain("Vitamin C: 8.1 mg");
  });
});
