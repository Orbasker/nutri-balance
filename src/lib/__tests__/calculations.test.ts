import { describe, expect, it } from "vitest";

import {
  compareSubstanceProminence,
  getReferenceDailyValue,
  getSubstanceProminence,
} from "@/lib/calculations";

describe("getReferenceDailyValue", () => {
  it("resolves aliases for common B vitamins", () => {
    expect(getReferenceDailyValue("thiamin")).toBe(1.2);
    expect(getReferenceDailyValue("vitamin_b1")).toBe(1.2);
    expect(getReferenceDailyValue("niacin", "Vitamin B3 (Niacin)")).toBe(16);
  });
});

describe("getSubstanceProminence", () => {
  it("normalizes known nutrients against a reference daily value", () => {
    expect(
      getSubstanceProminence({
        name: "vitamin_a",
        displayName: "Vitamin A",
        amount: 900,
        unit: "mcg",
      }),
    ).toEqual({
      basis: "reference",
      score: 1,
    });
  });

  it("falls back to comparable mass units when no reference is available", () => {
    expect(
      getSubstanceProminence({
        name: "lycopene",
        displayName: "Lycopene",
        amount: 2.5,
        unit: "mg",
      }),
    ).toEqual({
      basis: "mass",
      score: 2500,
    });
  });
});

describe("compareSubstanceProminence", () => {
  it("prefers the nutrient with the larger share of its reference value", () => {
    const vitaminA = {
      name: "vitamin_a",
      displayName: "Vitamin A",
      amount: 835,
      unit: "mcg",
    };
    const niacin = {
      name: "niacin",
      displayName: "Vitamin B3 (Niacin)",
      amount: 1.3,
      unit: "mg",
    };

    expect(compareSubstanceProminence(vitaminA, niacin)).toBeGreaterThan(0);
  });
});
