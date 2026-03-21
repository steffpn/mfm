/**
 * Jaro-Winkler similarity for fuzzy deduplication matching.
 *
 * Used as a fallback when exact ISRC and exact normalized title+artist
 * don't match, to catch slight variations in metadata.
 */

/**
 * Jaro similarity between two strings.
 */
function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Jaro-Winkler similarity (0-1). Higher = more similar.
 * Gives a boost when strings share a common prefix.
 */
export function jaroWinkler(s1: string, s2: string): number {
  const jaroSim = jaro(s1, s2);

  // Common prefix (max 4 chars for Winkler boost)
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaroSim + prefix * 0.1 * (1 - jaroSim);
}

/**
 * Check if two songs are likely the same based on fuzzy title+artist matching.
 * Both title AND artist must exceed their thresholds.
 */
export function isFuzzyMatch(
  title1: string,
  artist1: string,
  title2: string,
  artist2: string,
  titleThreshold = 0.92,
  artistThreshold = 0.85,
): boolean {
  const titleSim = jaroWinkler(title1, title2);
  if (titleSim < titleThreshold) return false;

  const artistSim = jaroWinkler(artist1, artist2);
  return artistSim >= artistThreshold;
}
