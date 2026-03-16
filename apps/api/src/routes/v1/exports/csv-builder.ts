import { stringify, type Stringifier } from "csv-stringify";

const CSV_COLUMNS = [
  "Song Title",
  "Artist",
  "Station",
  "ISRC",
  "Started At",
  "Ended At",
  "Play Count",
];

/**
 * Characters that trigger formula interpretation in spreadsheet applications.
 * Prefixing with a single quote prevents CSV injection attacks.
 */
const FORMULA_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Sanitize a cell value to prevent CSV injection (formula injection).
 * If the value starts with a dangerous character, prefix with single quote.
 */
function sanitize(value: string): string {
  if (value.length > 0 && FORMULA_CHARS.has(value[0])) {
    return `'${value}`;
  }
  return value;
}

/**
 * Build a CSV Transform stream from an array of airplay events.
 *
 * Returns a csv-stringify Stringifier (Transform stream) that can be
 * piped directly to Fastify reply.send().
 */
export function buildCSVStream(events: Array<Record<string, unknown>>): Stringifier {
  const stringifier = stringify({ header: true, columns: CSV_COLUMNS });

  for (const event of events) {
    const station = event.station as { name: string } | null;
    const startedAt = event.startedAt as Date;
    const endedAt = event.endedAt as Date;

    stringifier.write([
      sanitize(String(event.songTitle ?? "")),
      sanitize(String(event.artistName ?? "")),
      sanitize(String(station?.name ?? "")),
      sanitize(String(event.isrc ?? "")),
      startedAt.toISOString(),
      endedAt.toISOString(),
      String(event.playCount ?? 0),
    ]);
  }

  stringifier.end();
  return stringifier;
}
