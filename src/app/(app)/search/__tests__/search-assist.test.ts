import { describe, expect, it } from "vitest";

import {
  dedupeSearchTerms,
  escapeLikePattern,
  getSimilarityThreshold,
  normalizeSearchTerm,
  shouldUseAiSearchAssist,
} from "../search-assist";

describe("search-assist helpers", () => {
  it("normalizes duplicate whitespace", () => {
    expect(normalizeSearchTerm("  chicken   breast  ")).toBe("chicken breast");
  });

  it("dedupes terms case-insensitively and removes the original query", () => {
    expect(dedupeSearchTerms(["Banana", "banana", "Plantain"], "banana")).toEqual(["Plantain"]);
  });

  it("escapes wildcard characters for LIKE queries", () => {
    expect(escapeLikePattern("100%_juice\\fresh")).toBe("100\\%\\_juice\\\\fresh");
  });

  it("uses stricter trigram thresholds for short queries", () => {
    expect(getSimilarityThreshold("egg")).toBeGreaterThan(getSimilarityThreshold("cucumber"));
  });

  it("only enables AI assist for Hebrew queries", () => {
    expect(shouldUseAiSearchAssist("בננה")).toBe(true);
    expect(shouldUseAiSearchAssist("banana")).toBe(false);
  });
});
