import { describe, expect, it } from "vitest";

import { approveFoodSchema, dismissFeedbackSchema, submitFeedbackSchema } from "@/lib/validators";

const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("submitFeedbackSchema", () => {
  it("accepts valid flag feedback", () => {
    const result = submitFeedbackSchema.safeParse({
      foodId: validUuid,
      type: "flag",
      message: "The sodium value seems incorrect for this food.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid correction feedback with suggested value", () => {
    const result = submitFeedbackSchema.safeParse({
      foodId: validUuid,
      nutrientId: validUuid,
      foodVariantId: validUuid,
      type: "correction",
      message: "The sodium value should be 142mg per USDA database.",
      suggestedValue: 142,
      suggestedUnit: "mg",
      sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html",
    });
    expect(result.success).toBe(true);
  });

  it("rejects message shorter than 10 characters", () => {
    const result = submitFeedbackSchema.safeParse({
      foodId: validUuid,
      type: "flag",
      message: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid feedback type", () => {
    const result = submitFeedbackSchema.safeParse({
      foodId: validUuid,
      type: "invalid",
      message: "This is a valid message length.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative suggested value", () => {
    const result = submitFeedbackSchema.safeParse({
      foodId: validUuid,
      type: "correction",
      message: "The value should be corrected to the proper amount.",
      suggestedValue: -5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid source URL", () => {
    const result = submitFeedbackSchema.safeParse({
      foodId: validUuid,
      type: "flag",
      message: "This is a valid message for the feedback form.",
      sourceUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing foodId", () => {
    const result = submitFeedbackSchema.safeParse({
      type: "flag",
      message: "This is a valid message for the feedback form.",
    });
    expect(result.success).toBe(false);
  });
});

describe("approveFoodSchema", () => {
  it("accepts valid foodId", () => {
    const result = approveFoodSchema.safeParse({ foodId: validUuid });
    expect(result.success).toBe(true);
  });

  it("rejects invalid uuid", () => {
    const result = approveFoodSchema.safeParse({ foodId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("dismissFeedbackSchema", () => {
  it("accepts valid feedbackId", () => {
    const result = dismissFeedbackSchema.safeParse({ feedbackId: validUuid });
    expect(result.success).toBe(true);
  });

  it("rejects missing feedbackId", () => {
    const result = dismissFeedbackSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
