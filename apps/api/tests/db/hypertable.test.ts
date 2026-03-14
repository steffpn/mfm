import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";

describe("TimescaleDB Hypertable Setup", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("detections table is a hypertable", async () => {
    const result = await prisma.$queryRaw<Array<{ hypertable_name: string }>>`
      SELECT hypertable_name
      FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'detections'
    `;
    expect(result).toHaveLength(1);
    expect(result[0].hypertable_name).toBe("detections");
  });

  it("hypertable uses 1-day chunk interval", async () => {
    const result = await prisma.$queryRaw<Array<{ time_interval: string }>>`
      SELECT time_interval::text
      FROM timescaledb_information.dimensions
      WHERE hypertable_name = 'detections'
    `;
    expect(result).toHaveLength(1);
    expect(result[0].time_interval).toMatch(/1 day/);
  });

  it("continuous aggregates exist", async () => {
    const result = await prisma.$queryRaw<Array<{ view_name: string }>>`
      SELECT view_name
      FROM timescaledb_information.continuous_aggregates
      ORDER BY view_name
    `;
    const names = result.map((r) => r.view_name);
    expect(names).toContain("daily_station_plays");
    expect(names).toContain("weekly_artist_plays");
    expect(names).toContain("monthly_song_plays");
  });

  it("can insert and query a detection record", async () => {
    // Create a test station first
    const station = await prisma.station.create({
      data: {
        name: "Test Radio",
        streamUrl: "https://stream.test.ro/live",
        stationType: "radio",
        acrcloudStreamId: "test-hypertable-" + Date.now(),
      },
    });

    // Insert a detection
    const detection = await prisma.detection.create({
      data: {
        stationId: station.id,
        detectedAt: new Date(),
        songTitle: "Test Song",
        artistName: "Test Artist",
        confidence: 95.5,
        durationMs: 210000,
      },
    });

    expect(detection.id).toBeDefined();
    expect(detection.songTitle).toBe("Test Song");

    // Clean up
    await prisma.detection.delete({
      where: {
        id_detectedAt: {
          id: detection.id,
          detectedAt: detection.detectedAt,
        },
      },
    });
    await prisma.station.delete({ where: { id: station.id } });
  });
});
