/**
 * Normalize a music title for deduplication matching.
 *
 * Steps:
 * 1. Unicode NFKD decomposition (decompose accented chars)
 * 2. Strip combining diacritical marks
 * 3. Lowercase
 * 4. Remove content in parentheses/brackets (remix info, feat. credits)
 * 5. Remove apostrophes
 * 6. Collapse whitespace
 * 7. Trim
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/\s*[(["][^)\]"]*[)\]"]\s*/g, " ") // remove (remix), [feat. X]
    .replace(/'/g, "") // strip apostrophes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize an artist name for deduplication matching.
 *
 * Steps:
 * 1. Unicode NFKD decomposition
 * 2. Strip diacritical marks
 * 3. Lowercase
 * 4. Normalize separators: & -> and, ; -> and, feat. -> and
 * 5. Remove apostrophes
 * 6. Collapse whitespace
 * 7. Trim
 */
export function normalizeArtist(artist: string): string {
  return artist
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/\s*[&;]\s*/g, " and ") // normalize & and ; separators
    .replace(/\s*feat\.?\s*/gi, " and ") // normalize feat./feat
    .replace(/'/g, "") // strip apostrophes
    .replace(/\s+/g, " ")
    .trim();
}
