/**
 * False positive filter for ACRCloud detections.
 *
 * Filters out:
 * - DJ mashups/mixes/bootlegs
 * - Songs with primarily non-Latin characters (wrong catalog matches)
 * - Low confidence detections without ISRC
 */

const DJ_MIX_PATTERNS = /\b(mashup|mash[- ]up|megamix|minimix|live\s+mix|live\s+mashup|bootleg|medley)\b/i;
const DJ_ARTIST_PATTERNS = /^(dj\s+(godfather|tormenta|kmaba|nour|perreo|lopetoms|buzz|maze|juanito))\b/i;

/**
 * Check if title or artist contains primarily non-Latin characters.
 * Allows Latin Extended (Romanian diacritics) and common punctuation.
 */
function hasNonLatinScript(text: string): boolean {
  if (!text) return false;
  // Count alphabetic characters
  const alphaChars = text.replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g, "");
  const nonLatinChars = text.replace(/[^一-龥ぁ-ゟ゠-ヿ가-힣\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u1000-\u109F]/g, "");
  // If more non-Latin alphabetic chars than Latin, it's likely a false match
  return nonLatinChars.length > 0 && nonLatinChars.length >= alphaChars.length * 0.3;
}

export interface FilterResult {
  filtered: boolean;
  reason?: string;
}

export function filterDetection(
  title: string,
  artistName: string,
  score: number,
  isrc: string | null,
): FilterResult {
  // 1. DJ mashups/mixes
  if (DJ_MIX_PATTERNS.test(title) || DJ_MIX_PATTERNS.test(artistName)) {
    return { filtered: true, reason: "mashup/mix" };
  }

  // Known false-positive DJ artists
  if (DJ_ARTIST_PATTERNS.test(artistName)) {
    return { filtered: true, reason: "dj-artist" };
  }

  // 2. Non-Latin character detection
  if (hasNonLatinScript(title) || hasNonLatinScript(artistName)) {
    return { filtered: true, reason: "non-latin" };
  }

  // 3. Tiered confidence: 70-84 without ISRC is suspicious
  if (score < 85 && !isrc) {
    return { filtered: true, reason: "low-confidence-no-isrc" };
  }

  return { filtered: false };
}
