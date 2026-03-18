/**
 * Segment resolver -- maps a detection timestamp to the ring buffer segment
 * files that contain the relevant audio window.
 *
 * Given a detection timestamp, finds segments covering 25s before + 5s after
 * detection (30s total clip). Includes extra segments for safety margin.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "../services/supervisor/ffmpeg.js";

interface SegmentInfo {
  path: string;
  mtime: number; // ms timestamp of last modification
}

/**
 * Resolve which segment files cover the 30-second window around a detection.
 * Window: [detectedAt - 25s, detectedAt + 5s]
 *
 * Includes extra segments beyond the window edges to ensure FFmpeg has
 * enough data to extract a full 30s clip.
 *
 * @param stationId - Station database ID
 * @param detectedAt - Detection timestamp from ACRCloud
 * @returns Segments and seek offset, or null if no matching segments found
 */
export async function resolveSegments(
  stationId: number,
  detectedAt: Date,
): Promise<{ segments: string[]; seekOffsetSeconds: number } | null> {
  const segmentDir = path.join(DATA_DIR, String(stationId));

  let files: string[];
  try {
    files = await fs.readdir(segmentDir);
  } catch {
    return null;
  }

  const segmentInfos: SegmentInfo[] = [];
  for (const file of files) {
    if (!file.endsWith(".ts")) continue;
    const filePath = path.join(segmentDir, file);
    const stat = await fs.stat(filePath);
    segmentInfos.push({ path: filePath, mtime: stat.mtimeMs });
  }

  if (segmentInfos.length === 0) return null;

  // Sort by mtime ascending (oldest first)
  segmentInfos.sort((a, b) => a.mtime - b.mtime);

  const targetMs = detectedAt.getTime();
  const windowStart = targetMs - 25000; // 25s before detection
  const windowEnd = targetMs + 5000; // 5s after detection

  // Find segments that overlap with the window, plus 1 extra on each side
  const relevantIndices: number[] = [];
  for (let i = 0; i < segmentInfos.length; i++) {
    const segStart = segmentInfos[i].mtime - 10000;
    const segEnd = segmentInfos[i].mtime;
    if (segEnd >= windowStart && segStart <= windowEnd) {
      relevantIndices.push(i);
    }
  }

  if (relevantIndices.length === 0) return null;

  // Add 1 extra segment before and after for safety
  const firstIdx = Math.max(0, relevantIndices[0] - 1);
  const lastIdx = Math.min(segmentInfos.length - 1, relevantIndices[relevantIndices.length - 1] + 1);

  const selectedSegments: SegmentInfo[] = [];
  for (let i = firstIdx; i <= lastIdx; i++) {
    selectedSegments.push(segmentInfos[i]);
  }

  // Calculate seek offset from start of first selected segment to window start
  const firstSegStart = selectedSegments[0].mtime - 10000;
  const seekOffsetSeconds = Math.max(0, (windowStart - firstSegStart) / 1000);

  return {
    segments: selectedSegments.map((s) => s.path),
    seekOffsetSeconds,
  };
}
