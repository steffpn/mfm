import { describe, it, expect } from "vitest";
import { normalizeTitle, normalizeArtist } from "../../src/lib/normalization.js";

describe("normalizeTitle", () => {
  it("removes parenthetical content and lowercases", () => {
    expect(normalizeTitle("Doua Inimi (Remix)")).toBe("doua inimi");
  });

  it("lowercases all-caps titles", () => {
    expect(normalizeTitle("DRAGOSTEA DIN TEI")).toBe("dragostea din tei");
  });

  it("removes bracket content", () => {
    expect(normalizeTitle("Fata din vis [feat. Smiley]")).toBe("fata din vis");
  });

  it("normalizes Romanian diacritics identically", () => {
    // "Sarut Mana" with and without diacritics should match
    const withDiacritics = normalizeTitle("S\u0103rut M\u00e2n\u0103");
    const withoutDiacritics = normalizeTitle("Sarut Mana");
    // Both should produce the same normalized string
    expect(withDiacritics).toBe(withoutDiacritics);
  });

  it("strips diacritics from Romanian characters", () => {
    expect(normalizeTitle("\u0218i \u021Bi-am zis")).toBe("si ti-am zis");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeTitle("  hello   world  ")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("handles title with multiple parenthetical groups", () => {
    expect(normalizeTitle("Song (Radio Edit) (Remaster)")).toBe("song");
  });
});

describe("normalizeArtist", () => {
  it("normalizes ampersand separator to 'and'", () => {
    expect(normalizeArtist("Irina Rimes & Carla's Dreams")).toBe(
      "irina rimes and carlas dreams",
    );
  });

  it("normalizes 'feat.' separator to 'and'", () => {
    expect(normalizeArtist("Smiley feat. Delia")).toBe("smiley and delia");
  });

  it("normalizes 'feat' without dot to 'and'", () => {
    expect(normalizeArtist("Smiley feat Delia")).toBe("smiley and delia");
  });

  it("normalizes semicolon separator to 'and'", () => {
    expect(normalizeArtist("Irina Rimes; Carla's Dreams")).toBe(
      "irina rimes and carlas dreams",
    );
  });

  it("handles Unicode diacritics (Romanian characters)", () => {
    // \u0219 = s-comma-below, \u021b = t-comma-below, \u0103 = a-breve, \u00e2 = a-circumflex, \u00ee = i-circumflex
    expect(normalizeArtist("\u0218tefan B\u0103nic\u0103")).toBe(
      "stefan banica",
    );
  });

  it("handles multiple separators in one string", () => {
    expect(normalizeArtist("A & B feat. C; D")).toBe("a and b and c and d");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeArtist("  Artist   Name  ")).toBe("artist name");
  });

  it("handles empty string", () => {
    expect(normalizeArtist("")).toBe("");
  });

  it("strips apostrophes from possessives", () => {
    // "Carla's Dreams" -> "carlas dreams"
    expect(normalizeArtist("Carla's Dreams")).toBe("carlas dreams");
  });
});
