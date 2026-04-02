import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUBSTANCE_REFERENCE_VALUES,
  sanitizeSubstanceReferenceValues,
} from "@/lib/substance-reference-values";

describe("sanitizeSubstanceReferenceValues", () => {
  it("merges valid overrides into the default table", () => {
    const result = sanitizeSubstanceReferenceValues({
      "Vitamin A": 950,
      niacin: "18",
      invalid: "nope",
      zero: 0,
    });

    expect(result.vitamin_a).toBe(950);
    expect(result.niacin).toBe(18);
    expect(result.protein).toBe(DEFAULT_SUBSTANCE_REFERENCE_VALUES.protein);
    expect(result.invalid).toBeUndefined();
    expect(result.zero).toBeUndefined();
  });

  it("falls back to defaults for non-object input", () => {
    expect(sanitizeSubstanceReferenceValues(null)).toEqual(DEFAULT_SUBSTANCE_REFERENCE_VALUES);
  });
});
