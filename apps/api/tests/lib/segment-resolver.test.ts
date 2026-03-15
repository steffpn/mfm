import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock node:fs/promises ----
const mockReaddir = vi.fn();
const mockStat = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    stat: (...args: unknown[]) => mockStat(...args),
  },
  readdir: (...args: unknown[]) => mockReaddir(...args),
  stat: (...args: unknown[]) => mockStat(...args),
}));

// ---- Mock supervisor ffmpeg to control DATA_DIR ----
vi.mock("../../src/services/supervisor/ffmpeg.js", () => ({
  DATA_DIR: "/mock/data/streams",
}));

describe("Segment Resolver", () => {
  let resolveSegments: typeof import("../../src/lib/segment-resolver.js").resolveSegments;

  beforeEach(async () => {
    mockReaddir.mockReset();
    mockStat.mockReset();

    const mod = await import("../../src/lib/segment-resolver.js");
    resolveSegments = mod.resolveSegments;
  });

  it("resolves correct segments when detection timestamp falls within a single segment's time range", async () => {
    const detectedAt = new Date("2026-03-15T14:30:05.000Z");
    // A single segment whose mtime means it covers [14:29:55, 14:30:05]
    // mtime = segment write completion time, segment covers [mtime - 10s, mtime]
    const segmentMtime = new Date("2026-03-15T14:30:05.000Z").getTime();

    mockReaddir.mockResolvedValue(["segment-000.ts"]);
    mockStat.mockResolvedValue({ mtimeMs: segmentMtime });

    const result = await resolveSegments(1, detectedAt);

    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(1);
    expect(result!.segments[0]).toBe("/mock/data/streams/1/segment-000.ts");
    expect(result!.seekOffsetSeconds).toBeGreaterThanOrEqual(0);
  });

  it("resolves two adjacent segments when detection timestamp falls near a segment boundary", async () => {
    const detectedAt = new Date("2026-03-15T14:30:10.000Z");
    // Segment 1: mtime = 14:30:10 -> covers [14:30:00, 14:30:10]
    // Segment 2: mtime = 14:30:20 -> covers [14:30:10, 14:30:20]
    // Window: [14:30:07.5, 14:30:12.5] -> overlaps both segments

    const seg1Mtime = new Date("2026-03-15T14:30:10.000Z").getTime();
    const seg2Mtime = new Date("2026-03-15T14:30:20.000Z").getTime();

    mockReaddir.mockResolvedValue(["segment-000.ts", "segment-001.ts"]);
    mockStat
      .mockResolvedValueOnce({ mtimeMs: seg1Mtime })
      .mockResolvedValueOnce({ mtimeMs: seg2Mtime });

    const result = await resolveSegments(1, detectedAt);

    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0]).toBe("/mock/data/streams/1/segment-000.ts");
    expect(result!.segments[1]).toBe("/mock/data/streams/1/segment-001.ts");
  });

  it("returns null when no segment files exist in the station directory", async () => {
    const detectedAt = new Date("2026-03-15T14:30:05.000Z");

    mockReaddir.mockResolvedValue([]);

    const result = await resolveSegments(1, detectedAt);

    expect(result).toBeNull();
  });

  it("returns null when all segments are too old (detection happened after buffer wrapped)", async () => {
    const detectedAt = new Date("2026-03-15T14:35:00.000Z");
    // Segment from 5 minutes ago (300s) -- way before detection window
    const oldMtime = new Date("2026-03-15T14:30:00.000Z").getTime();

    mockReaddir.mockResolvedValue(["segment-000.ts"]);
    mockStat.mockResolvedValue({ mtimeMs: oldMtime });

    const result = await resolveSegments(1, detectedAt);

    expect(result).toBeNull();
  });

  it("calculates correct seekOffsetSeconds from start of first segment to window start", async () => {
    const detectedAt = new Date("2026-03-15T14:30:05.000Z");
    // Segment mtime = 14:30:10 -> covers [14:30:00, 14:30:10]
    // Window start = 14:30:02.5
    // seekOffset = (14:30:02.5 - 14:30:00) / 1000 = 2.5
    const segmentMtime = new Date("2026-03-15T14:30:10.000Z").getTime();

    mockReaddir.mockResolvedValue(["segment-000.ts"]);
    mockStat.mockResolvedValue({ mtimeMs: segmentMtime });

    const result = await resolveSegments(1, detectedAt);

    expect(result).not.toBeNull();
    expect(result!.seekOffsetSeconds).toBeCloseTo(2.5, 1);
  });

  it("handles non-.ts files in the directory gracefully (ignores them)", async () => {
    const detectedAt = new Date("2026-03-15T14:30:05.000Z");
    const segmentMtime = new Date("2026-03-15T14:30:05.000Z").getTime();

    mockReaddir.mockResolvedValue([
      "segment-000.ts",
      ".gitkeep",
      "metadata.json",
      "segment-001.log",
    ]);
    // Only the .ts file should be stat'd
    mockStat.mockResolvedValue({ mtimeMs: segmentMtime });

    const result = await resolveSegments(1, detectedAt);

    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(1);
    // stat should only be called once (for the .ts file)
    expect(mockStat).toHaveBeenCalledTimes(1);
  });

  it("returns null when station directory does not exist", async () => {
    const detectedAt = new Date("2026-03-15T14:30:05.000Z");

    mockReaddir.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );

    const result = await resolveSegments(1, detectedAt);

    expect(result).toBeNull();
  });
});
