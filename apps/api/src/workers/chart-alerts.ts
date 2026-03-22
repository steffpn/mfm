/**
 * Chart Alerts worker.
 *
 * Daily cron job that:
 * 1. Scrapes Shazam, Spotify, Apple Music public charts
 * 2. Stores chart entries in DB
 * 3. Compares against monitored songs (artists/labels)
 * 4. Sends push notifications for new chart entries / position changes
 *
 * Runs daily at 10 AM Europe/Bucharest.
 */

import { Worker, Queue } from "bullmq";
import { Notification, ApnsError } from "apns2";
import { createRedisConnection } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { getApnsClient } from "../lib/apns.js";
import pino from "pino";

const logger = pino({ name: "chart-alerts-worker" });
const QUEUE_NAME = "chart-alerts";

// ─── Chart Scrapers ────────────────────────────────────────────────

interface ChartSong {
  position: number;
  songTitle: string;
  artistName: string;
  isrc?: string;
}

/**
 * Scrape Shazam top charts for a country.
 * Uses Shazam's public discovery endpoint.
 */
async function scrapeShazamChart(country: string): Promise<ChartSong[]> {
  try {
    const url = `https://www.shazam.com/services/charts/discovery/top-${country.toLowerCase()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MFM/1.0)" },
    });

    if (!res.ok) {
      // Try alternative Shazam API endpoint
      const altUrl = `https://www.shazam.com/shazam/v3/en/GB/web/-/tracks/ip-country-chart-${country.toUpperCase()}?pageSize=50&startFrom=0`;
      const altRes = await fetch(altUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MFM/1.0)" },
      });
      if (!altRes.ok) {
        logger.warn({ country, status: altRes.status }, "Shazam chart scrape failed");
        return [];
      }
      const data = await altRes.json() as any;
      return (data.tracks || []).map((t: any, i: number) => ({
        position: i + 1,
        songTitle: t.heading?.title || t.title || "Unknown",
        artistName: t.heading?.subtitle || t.subtitle || "Unknown",
      }));
    }

    const data = await res.json() as any;
    return (data.tracks || data.chart || []).map((t: any, i: number) => ({
      position: i + 1,
      songTitle: t.heading?.title || t.title || "Unknown",
      artistName: t.heading?.subtitle || t.subtitle || "Unknown",
    }));
  } catch (err) {
    logger.error({ country, err }, "Shazam scrape error");
    return [];
  }
}

/**
 * Scrape Spotify daily top charts.
 * Uses Spotify Charts public page data.
 */
async function scrapeSpotifyChart(country: string): Promise<ChartSong[]> {
  try {
    const url = `https://charts-spotify-com-service.spotify.com/public/v2/charts/regional-${country.toLowerCase()}-daily/latest`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MFM/1.0)" },
    });

    if (!res.ok) {
      logger.warn({ country, status: res.status }, "Spotify chart scrape failed");
      return [];
    }

    const data = await res.json() as any;
    return (data.entries || data.chartEntryViewResponses || [])
      .slice(0, 50)
      .map((e: any, i: number) => ({
        position: e.chartEntryData?.currentRank || i + 1,
        songTitle: e.trackMetadata?.trackName || "Unknown",
        artistName: e.trackMetadata?.artists?.map((a: any) => a.name).join(", ") || "Unknown",
      }));
  } catch (err) {
    logger.error({ country, err }, "Spotify scrape error");
    return [];
  }
}

/**
 * Scrape Apple Music top charts.
 * Uses Apple's public RSS feed.
 */
async function scrapeAppleMusicChart(country: string): Promise<ChartSong[]> {
  try {
    const url = `https://rss.applemarketingtools.com/api/v2/${country.toLowerCase()}/music/most-played/50/songs.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MFM/1.0)" },
    });

    if (!res.ok) {
      logger.warn({ country, status: res.status }, "Apple Music chart scrape failed");
      return [];
    }

    const data = await res.json() as any;
    return (data.feed?.results || []).map((r: any, i: number) => ({
      position: i + 1,
      songTitle: r.name || "Unknown",
      artistName: r.artistName || "Unknown",
    }));
  } catch (err) {
    logger.error({ country, err }, "Apple Music scrape error");
    return [];
  }
}

// ─── Main Process ──────────────────────────────────────────────────

async function processChartAlerts(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all countries that users are tracking
  const userSettings = await prisma.userSettings.findMany({
    where: { chartAlertsEnabled: true },
    select: { chartAlertCountries: true },
  });

  const countries = [...new Set(userSettings.flatMap((s) => s.chartAlertCountries))];
  if (countries.length === 0) countries.push("RO"); // Default

  logger.info({ countries }, "Scraping charts");

  // Scrape all charts for all countries
  for (const country of countries) {
    const scrapers: Array<{ platform: string; chartName: string; fn: () => Promise<ChartSong[]> }> = [
      { platform: "shazam", chartName: "Top 50", fn: () => scrapeShazamChart(country) },
      { platform: "spotify", chartName: "Daily Top 50", fn: () => scrapeSpotifyChart(country) },
      { platform: "apple_music", chartName: "Top 50", fn: () => scrapeAppleMusicChart(country) },
    ];

    for (const { platform, chartName, fn } of scrapers) {
      const songs = await fn();
      logger.info({ platform, country, count: songs.length }, "Chart scraped");

      for (const song of songs) {
        await prisma.chartEntry.upsert({
          where: {
            platform_country_chartName_position_snapshotDate: {
              platform,
              country,
              chartName,
              position: song.position,
              snapshotDate: today,
            },
          },
          update: {
            songTitle: song.songTitle,
            artistName: song.artistName,
            isrc: song.isrc,
          },
          create: {
            platform,
            country,
            chartName,
            position: song.position,
            songTitle: song.songTitle,
            artistName: song.artistName,
            isrc: song.isrc,
            snapshotDate: today,
          },
        });
      }
    }
  }

  // Now check against monitored songs and generate alerts
  await generateAlerts(today);
}

async function generateAlerts(snapshotDate: Date): Promise<void> {
  const apns = getApnsClient();
  const yesterday = new Date(snapshotDate);
  yesterday.setDate(yesterday.getDate() - 1);

  // Get all monitored songs (artist + label)
  const monitoredSongs = await prisma.monitoredSong.findMany({
    where: { status: "active" },
    include: {
      user: {
        include: {
          deviceTokens: true,
          settings: true,
        },
      },
      labelMonitoredSongs: {
        include: {
          labelArtist: {
            include: {
              labelUser: {
                include: {
                  deviceTokens: true,
                  settings: true,
                },
              },
            },
          },
        },
      },
    },
  });

  for (const ms of monitoredSongs) {
    // Find chart entries matching this song (by artist name + song title fuzzy, or ISRC)
    const todayEntries = await prisma.chartEntry.findMany({
      where: {
        snapshotDate,
        OR: [
          ...(ms.isrc ? [{ isrc: ms.isrc }] : []),
          {
            artistName: { contains: ms.artistName, mode: "insensitive" as const },
            songTitle: { contains: ms.songTitle, mode: "insensitive" as const },
          },
        ],
      },
    });

    if (todayEntries.length === 0) continue;

    // Check yesterday's entries to determine alert type
    for (const entry of todayEntries) {
      const yesterdayEntry = await prisma.chartEntry.findFirst({
        where: {
          platform: entry.platform,
          country: entry.country,
          chartName: entry.chartName,
          snapshotDate: yesterday,
          OR: [
            ...(ms.isrc ? [{ isrc: ms.isrc }] : []),
            { songTitle: entry.songTitle, artistName: entry.artistName },
          ],
        },
      });

      let alertType: string;
      let message: string;
      const platformLabel =
        entry.platform === "shazam" ? "Shazam" :
        entry.platform === "spotify" ? "Spotify" :
        "Apple Music";

      if (!yesterdayEntry) {
        alertType = "entered";
        message = `Hey! "${entry.songTitle}" just entered ${platformLabel} ${entry.chartName} in ${entry.country} at #${entry.position}! 🎉`;
      } else if (entry.position < yesterdayEntry.position) {
        alertType = "moved_up";
        message = `"${entry.songTitle}" moved up from #${yesterdayEntry.position} to #${entry.position} on ${platformLabel} ${entry.chartName} in ${entry.country}! 📈`;
      } else {
        continue; // No alert for steady or declining
      }

      // Send to artist user
      const artistSettings = ms.user.settings;
      if (!artistSettings || artistSettings.chartAlertsEnabled !== false) {
        if (artistSettings?.chartAlertCountries?.length &&
            !artistSettings.chartAlertCountries.includes(entry.country)) {
          continue;
        }

        await createAndSendAlert(
          ms.userId,
          entry,
          alertType,
          message,
          ms.user.deviceTokens,
          apns,
        );
      }

      // Send to label users
      for (const lms of ms.labelMonitoredSongs) {
        const labelUser = lms.labelArtist.labelUser;
        const labelSettings = labelUser.settings;
        if (labelSettings && labelSettings.chartAlertsEnabled === false) continue;

        await createAndSendAlert(
          labelUser.id,
          entry,
          alertType,
          message,
          labelUser.deviceTokens,
          apns,
        );
      }
    }
  }
}

async function createAndSendAlert(
  userId: number,
  entry: { songTitle: string; artistName: string; isrc: string | null; platform: string; country: string; chartName: string; position: number },
  alertType: string,
  message: string,
  deviceTokens: Array<{ token: string }>,
  apns: ReturnType<typeof getApnsClient>,
): Promise<void> {
  // Check for duplicate alert
  const existing = await prisma.chartAlert.findFirst({
    where: {
      userId,
      platform: entry.platform,
      country: entry.country,
      chartName: entry.chartName,
      alertType,
      songTitle: entry.songTitle,
      sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (existing) return;

  await prisma.chartAlert.create({
    data: {
      userId,
      songTitle: entry.songTitle,
      artistName: entry.artistName,
      isrc: entry.isrc,
      platform: entry.platform,
      country: entry.country,
      chartName: entry.chartName,
      position: entry.position,
      alertType,
      message,
    },
  });

  // Send push notification
  if (apns) {
    for (const dt of deviceTokens) {
      try {
        const notification = new Notification(dt.token, {
          alert: {
            title: "Chart Alert! 📊",
            body: message,
          },
          data: {
            type: "chart_alert",
            platform: entry.platform,
            country: entry.country,
          },
        });
        await apns.send(notification);
      } catch (err) {
        if (err instanceof ApnsError) {
          if (err.reason === "BadDeviceToken" || err.reason === "Unregistered") {
            await prisma.deviceToken.deleteMany({ where: { token: dt.token } });
          }
        }
        logger.error({ userId, err }, "Failed to send chart alert push");
      }
    }
  }
}

// ─── API endpoint for chart alerts ─────────────────────────────────

// Exported for use in routes (not the worker)

// ─── Worker Lifecycle ──────────────────────────────────────────────

export async function startChartAlertsWorker(): Promise<{
  queue: Queue;
  worker: Worker;
}> {
  const queue = new Queue(QUEUE_NAME, {
    connection: createRedisConnection(),
  });

  // Run daily at 10 AM Europe/Bucharest
  await queue.upsertJobScheduler(
    "chart-alerts-scheduler",
    { pattern: "0 10 * * *", tz: "Europe/Bucharest" },
    { name: "chart-alerts", data: {} },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === "chart-alerts") {
        logger.info("Running chart alerts processing");
        await processChartAlerts();
        logger.info("Chart alerts processing complete");
      }
    },
    { connection: createRedisConnection() },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Chart alerts job failed");
  });

  logger.info("Chart alerts worker started (daily 10AM Europe/Bucharest)");

  return { queue, worker };
}
