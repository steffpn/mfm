/**
 * Enhanced Daily Stats Report worker.
 *
 * Generates engaging daily reports with tips & punchlines per role.
 * Premium users get detailed, actionable insights.
 * Free users get generic motivational hints.
 *
 * Per-user configurable timing via UserSettings.dailyReportTime.
 * Delivery: Push notification (APNS). Email: TODO.
 *
 * Scheduled: runs every hour, checks which users should receive their report
 * based on their configured time + timezone.
 */

import { Worker, Queue } from "bullmq";
import { Notification, ApnsError } from "apns2";
import { createRedisConnection } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { getApnsClient } from "../lib/apns.js";
import pino from "pino";

const logger = pino({ name: "daily-report-worker" });
const QUEUE_NAME = "daily-report";

// ─── Tip Templates ─────────────────────────────────────────────────

const ARTIST_FREE_TIPS = [
  "Keep pushing! Consistency is key for radio play.",
  "Your music is out there — stay active on socials to keep the momentum.",
  "Consider reaching out to playlist curators to boost visibility.",
  "Engage your fans — they're your best promo team.",
  "Good things take time. Keep releasing and stay patient.",
  "Radio loves consistency — think about your next single already.",
];

const ARTIST_PREMIUM_TIPS = {
  rising: [
    "Your song {song} gained {delta} plays on {station} — it's picking up. Push promo on this station's social handles!",
    "Peak hour for {song} was {peakHour} — consider scheduling your social posts around that time.",
    "{song} is trending up {percent}% week-over-week. This is the moment to pitch it to more stations.",
    "Your airplay on {station} spiked — reach out to their music director and thank them. Relationships matter.",
  ],
  steady: [
    "{song} is holding steady at {plays} plays/day on {station}. Solid rotation — keep the promo going.",
    "Your plays are consistent. Consider a remix or acoustic version to re-ignite interest.",
    "{station} plays your music mostly at {peakHour}. Their audience is listening — make sure your socials are active at that time.",
  ],
  declining: [
    "{song} dropped {delta} plays on {station}. Time to refresh your promo strategy — how about a TikTok sound?",
    "Plays are cooling off. Consider a new single to bring attention back to your catalog.",
    "Your rotation on {station} is slowing. A feature or collab could give it a second wind.",
    "Baby, you need to work on promo. How about some TikTok sounds? 🎵",
  ],
  celebration: [
    "You can finally order that new bike you love so much! 🚲 {song} hit {plays} total plays!",
    "Pop the champagne! 🍾 {song} just had its best day ever with {plays} plays!",
    "Your music is on fire 🔥 — {plays} plays yesterday across all stations!",
  ],
};

const LABEL_FREE_TIPS = [
  "Check in on your artists' social media presence — it drives radio play.",
  "Keep monitoring which stations are most receptive to your catalog.",
  "A strong release schedule keeps your label top-of-mind for radio programmers.",
];

const LABEL_PREMIUM_TIPS = {
  rising: [
    "{artist}'s {song} gained {delta} plays — consider increasing their promo budget.",
    "{artist} is getting traction on {station}. Time to push more singles from this artist.",
  ],
  declining: [
    "{artist}'s airplay dropped {percent}%. Schedule a check-in about their promo strategy.",
    "Consider refreshing {artist}'s pitch to stations — the current single may need a boost.",
  ],
};

const STATION_FREE_TIPS = [
  "Keep your playlist fresh — listeners notice when you rotate new music.",
  "Check what your competitors are playing that you're not.",
  "Your listeners' attention span is gold — curate wisely.",
];

const STATION_PREMIUM_TIPS = {
  insight: [
    "You played {uniqueSongs} unique songs yesterday. Your competitor {competitor} played {competitorSongs}.",
    "Your discovery score is {discoveryScore}% — {comparison} the market average.",
    "{overRotated} songs are over-rotated. Consider reducing their frequency.",
    "Your playlist overlap with {competitor} is {overlap}%. Differentiate to stand out.",
  ],
};

const PUNCHLINES = [
  "Stay hungry, stay foolish, stay on rotation. 🎵",
  "Another day, another play. Let's get it! 💪",
  "The charts don't sleep, and neither should your promo.",
  "Music is a marathon, not a sprint. But sprinting helps.",
  "Remember: every hit song was once just a demo.",
  "Your stats called. They miss you already.",
  "My 2 cents? You're doing great. Keep going.",
];

// ─── Report Generation ─────────────────────────────────────────────

interface ArtistReportData {
  totalPlays: number;
  yesterdayPlays: number;
  dayBeforePlays: number;
  topSong: { title: string; plays: number; station: string; peakHour: string; delta: number } | null;
  weekOverWeekPercent: number;
}

interface LabelReportData {
  totalArtists: number;
  totalPlays: number;
  topArtist: { name: string; song: string; plays: number; delta: number; station: string } | null;
  decliningArtist: { name: string; percent: number } | null;
}

interface StationReportData {
  totalPlays: number;
  uniqueSongs: number;
  discoveryScore: number;
  overRotatedCount: number;
  topCompetitor: { name: string; uniqueSongs: number; overlap: number } | null;
}

async function generateArtistReport(userId: number, isPremium: boolean): Promise<{
  content: ArtistReportData;
  tips: string[];
  title: string;
  body: string;
}> {
  // Get user's monitored songs (via ISRCs)
  const monitoredSongs = await prisma.monitoredSong.findMany({
    where: { userId, status: "active" },
  });
  const isrcs = monitoredSongs.map((s) => s.isrc);

  if (isrcs.length === 0) {
    return {
      content: { totalPlays: 0, yesterdayPlays: 0, dayBeforePlays: 0, topSong: null, weekOverWeekPercent: 0 },
      tips: [pickRandom(ARTIST_FREE_TIPS)],
      title: "Daily Report",
      body: "Add some songs to monitor and we'll start tracking your airplay! 🎶",
    };
  }

  const [yesterdayRows, dayBeforeRows, topSongRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM airplay_events
      WHERE started_at >= CURRENT_DATE - INTERVAL '1 day'
        AND started_at < CURRENT_DATE
        AND isrc = ANY(${isrcs}::text[])
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM airplay_events
      WHERE started_at >= CURRENT_DATE - INTERVAL '2 days'
        AND started_at < CURRENT_DATE - INTERVAL '1 day'
        AND isrc = ANY(${isrcs}::text[])
    `,
    prisma.$queryRaw<Array<{ song_title: string; count: number; station_name: string; peak_hour: string }>>`
      SELECT ae.song_title, COUNT(*)::int AS count,
        (SELECT s.name FROM stations s
         JOIN airplay_events ae2 ON ae2.station_id = s.id
         WHERE ae2.isrc = ae.isrc
           AND ae2.started_at >= CURRENT_DATE - INTERVAL '1 day'
           AND ae2.started_at < CURRENT_DATE
         GROUP BY s.name ORDER BY COUNT(*) DESC LIMIT 1) AS station_name,
        EXTRACT(HOUR FROM ae.started_at)::text || ':00' AS peak_hour
      FROM airplay_events ae
      WHERE ae.started_at >= CURRENT_DATE - INTERVAL '1 day'
        AND ae.started_at < CURRENT_DATE
        AND ae.isrc = ANY(${isrcs}::text[])
      GROUP BY ae.song_title, ae.isrc, peak_hour
      ORDER BY count DESC
      LIMIT 1
    `,
  ]);

  const yesterdayPlays = Number(yesterdayRows[0]?.count ?? 0);
  const dayBeforePlays = Number(dayBeforeRows[0]?.count ?? 0);
  const delta = yesterdayPlays - dayBeforePlays;
  const weekOverWeekPercent = dayBeforePlays > 0
    ? Math.round(((yesterdayPlays - dayBeforePlays) / dayBeforePlays) * 100)
    : 0;

  const topSong = topSongRows.length > 0
    ? {
        title: topSongRows[0].song_title,
        plays: Number(topSongRows[0].count),
        station: topSongRows[0].station_name || "multiple stations",
        peakHour: topSongRows[0].peak_hour || "various",
        delta,
      }
    : null;

  const content: ArtistReportData = {
    totalPlays: yesterdayPlays,
    yesterdayPlays,
    dayBeforePlays,
    topSong,
    weekOverWeekPercent,
  };

  // Generate tips
  const tips: string[] = [];
  if (isPremium && topSong) {
    const trend = delta > 0 ? "rising" : delta < 0 ? "declining" : "steady";
    const templates = trend === "rising" && yesterdayPlays > dayBeforePlays * 1.5
      ? ARTIST_PREMIUM_TIPS.celebration
      : ARTIST_PREMIUM_TIPS[trend];
    const tip = pickRandom(templates)
      .replace(/\{song\}/g, topSong.title)
      .replace(/\{station\}/g, topSong.station)
      .replace(/\{delta\}/g, String(Math.abs(delta)))
      .replace(/\{plays\}/g, String(topSong.plays))
      .replace(/\{peakHour\}/g, topSong.peakHour)
      .replace(/\{percent\}/g, String(Math.abs(weekOverWeekPercent)));
    tips.push(tip);
  } else {
    tips.push(pickRandom(ARTIST_FREE_TIPS));
  }
  tips.push(pickRandom(PUNCHLINES));

  // Build notification text
  let body: string;
  if (yesterdayPlays === 0) {
    body = "No plays detected yesterday. Keep pushing — your next hit is around the corner! 💪";
  } else if (delta > 0) {
    body = `📈 ${yesterdayPlays} plays yesterday (+${delta}). ${topSong ? `'${topSong.title}' led with ${topSong.plays} plays.` : ""} You're on the rise!`;
  } else if (delta < 0) {
    body = `${yesterdayPlays} plays yesterday (${delta}). ${tips[0]}`;
  } else {
    body = `${yesterdayPlays} plays yesterday, same as before. Steady! ${topSong ? `'${topSong.title}' was your top track.` : ""}`;
  }

  return { content, tips, title: "Your Daily Airplay Report", body };
}

async function generateLabelReport(userId: number, isPremium: boolean): Promise<{
  content: LabelReportData;
  tips: string[];
  title: string;
  body: string;
}> {
  const artists = await prisma.labelArtist.findMany({
    where: { labelUserId: userId },
    include: {
      monitoredSongs: { include: { monitoredSong: true } },
    },
  });

  if (artists.length === 0) {
    return {
      content: { totalArtists: 0, totalPlays: 0, topArtist: null, decliningArtist: null },
      tips: [pickRandom(LABEL_FREE_TIPS)],
      title: "Label Daily Report",
      body: "Add artists to your roster to start tracking their performance! 🎵",
    };
  }

  const allIsrcs = artists.flatMap((a) =>
    a.monitoredSongs.map((ms) => ms.monitoredSong.isrc),
  );

  const [totalRows, topArtistRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM airplay_events
      WHERE started_at >= CURRENT_DATE - INTERVAL '1 day'
        AND started_at < CURRENT_DATE
        AND isrc = ANY(${allIsrcs}::text[])
    `,
    prisma.$queryRaw<Array<{ artist_name: string; song_title: string; count: number; station_name: string }>>`
      SELECT ae.artist_name, ae.song_title, COUNT(*)::int AS count,
        (SELECT s.name FROM stations s WHERE s.id = (
          SELECT ae2.station_id FROM airplay_events ae2
          WHERE ae2.artist_name = ae.artist_name
            AND ae2.started_at >= CURRENT_DATE - INTERVAL '1 day'
            AND ae2.started_at < CURRENT_DATE
          GROUP BY ae2.station_id ORDER BY COUNT(*) DESC LIMIT 1
        )) AS station_name
      FROM airplay_events ae
      WHERE ae.started_at >= CURRENT_DATE - INTERVAL '1 day'
        AND ae.started_at < CURRENT_DATE
        AND ae.isrc = ANY(${allIsrcs}::text[])
      GROUP BY ae.artist_name, ae.song_title
      ORDER BY count DESC
      LIMIT 1
    `,
  ]);

  const totalPlays = Number(totalRows[0]?.count ?? 0);
  const topArtist = topArtistRows.length > 0
    ? {
        name: topArtistRows[0].artist_name,
        song: topArtistRows[0].song_title,
        plays: Number(topArtistRows[0].count),
        delta: 0,
        station: topArtistRows[0].station_name || "multiple stations",
      }
    : null;

  const tips: string[] = [];
  if (isPremium && topArtist) {
    const tip = pickRandom(LABEL_PREMIUM_TIPS.rising)
      .replace(/\{artist\}/g, topArtist.name)
      .replace(/\{song\}/g, topArtist.song)
      .replace(/\{delta\}/g, String(topArtist.plays))
      .replace(/\{station\}/g, topArtist.station);
    tips.push(tip);
  } else {
    tips.push(pickRandom(LABEL_FREE_TIPS));
  }
  tips.push(pickRandom(PUNCHLINES));

  const body = totalPlays > 0
    ? `Your artists got ${totalPlays} plays yesterday. ${topArtist ? `${topArtist.name} led with '${topArtist.song}'.` : ""}`
    : "No plays detected yesterday for your artists. Time to push promo!";

  return {
    content: { totalArtists: artists.length, totalPlays, topArtist, decliningArtist: null },
    tips,
    title: "Label Daily Report",
    body,
  };
}

async function generateStationReport(userId: number, stationIds: number[], isPremium: boolean): Promise<{
  content: StationReportData;
  tips: string[];
  title: string;
  body: string;
}> {
  if (stationIds.length === 0) {
    return {
      content: { totalPlays: 0, uniqueSongs: 0, discoveryScore: 0, overRotatedCount: 0, topCompetitor: null },
      tips: [pickRandom(STATION_FREE_TIPS)],
      title: "Station Daily Report",
      body: "No station data available. Check your station configuration!",
    };
  }

  const [playsRows, uniqueSongsRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM airplay_events
      WHERE started_at >= CURRENT_DATE - INTERVAL '1 day'
        AND started_at < CURRENT_DATE
        AND station_id = ANY(${stationIds}::int[])
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT isrc)::int AS count FROM airplay_events
      WHERE started_at >= CURRENT_DATE - INTERVAL '1 day'
        AND started_at < CURRENT_DATE
        AND station_id = ANY(${stationIds}::int[])
        AND isrc IS NOT NULL
    `,
  ]);

  const totalPlays = Number(playsRows[0]?.count ?? 0);
  const uniqueSongs = Number(uniqueSongsRows[0]?.count ?? 0);

  const tips: string[] = [];
  if (isPremium) {
    const tip = pickRandom(STATION_PREMIUM_TIPS.insight)
      .replace(/\{uniqueSongs\}/g, String(uniqueSongs))
      .replace(/\{discoveryScore\}/g, String(Math.round((uniqueSongs / Math.max(totalPlays, 1)) * 100)))
      .replace(/\{overRotated\}/g, "Some")
      .replace(/\{competitor\}/g, "your top competitor")
      .replace(/\{competitorSongs\}/g, "N/A")
      .replace(/\{overlap\}/g, "N/A")
      .replace(/\{comparison\}/g, "around");
    tips.push(tip);
  } else {
    tips.push(pickRandom(STATION_FREE_TIPS));
  }
  tips.push(pickRandom(PUNCHLINES));

  const body = `${totalPlays} plays yesterday with ${uniqueSongs} unique songs. ${tips[0]}`;

  return {
    content: { totalPlays, uniqueSongs, discoveryScore: 0, overRotatedCount: 0, topCompetitor: null },
    tips,
    title: "Station Daily Report",
    body,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCurrentHourInTimezone(tz: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    hour12: false,
  });
  return formatter.format(now);
}

// ─── Main Process ──────────────────────────────────────────────────

async function processDailyReports(): Promise<void> {
  // Get all active users with their settings
  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      settings: true,
      scopes: true,
      deviceTokens: true,
      subscriptions: {
        where: { status: { in: ["active", "trialing"] } },
        include: { plan: true },
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    },
  });

  const apns = getApnsClient();

  for (const user of users) {
    try {
      const settings = user.settings;
      if (settings && !settings.dailyReportEnabled) continue;

      const tz = settings?.dailyReportTimezone || "Europe/Bucharest";
      const targetTime = settings?.dailyReportTime || "08:00";
      const currentTime = getCurrentHourInTimezone(tz);

      // Only process if current hour matches the user's configured hour
      // Compare HH:00 format (we run every hour)
      const currentHour = currentTime.split(":")[0];
      const targetHour = targetTime.split(":")[0];
      if (currentHour !== targetHour) continue;

      // Check if already sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await prisma.dailyReport.findUnique({
        where: { userId_reportDate: { userId: user.id, reportDate: today } },
      });
      if (existing) continue;

      const isPremium = user.subscriptions[0]?.plan?.tier === "PREMIUM";
      const stationIds = user.scopes
        .filter((s) => s.entityType === "STATION")
        .map((s) => s.entityId);

      let report: { content: unknown; tips: string[]; title: string; body: string };

      switch (user.role) {
        case "ARTIST":
          report = await generateArtistReport(user.id, isPremium);
          break;
        case "LABEL":
          report = await generateLabelReport(user.id, isPremium);
          break;
        case "STATION":
          report = await generateStationReport(user.id, stationIds, isPremium);
          break;
        default:
          continue;
      }

      // Save to DB
      await prisma.dailyReport.create({
        data: {
          userId: user.id,
          reportDate: today,
          content: report.content as any,
          tips: report.tips,
          isPremium,
          deliveredVia: ["push"], // TODO: add "email" when email is implemented
        },
      });

      // Send push notification
      if (apns && user.deviceTokens.length > 0) {
        for (const dt of user.deviceTokens) {
          try {
            const notification = new Notification(dt.token, {
              alert: {
                title: report.title,
                body: report.body,
              },
              data: {
                type: "daily_report",
                date: today.toISOString().split("T")[0],
              },
            });
            await apns.send(notification);
          } catch (err) {
            if (err instanceof ApnsError) {
              if (err.reason === "BadDeviceToken" || err.reason === "Unregistered") {
                await prisma.deviceToken.deleteMany({ where: { token: dt.token } });
                continue;
              }
            }
            logger.error({ userId: user.id, err }, "Failed to send daily report push");
          }
        }
      }

      // TODO: Send email when email service is implemented

      logger.info({ userId: user.id, role: user.role, isPremium }, "Daily report sent");
    } catch (err) {
      logger.error({ userId: user.id, err }, "Failed to generate daily report");
    }
  }
}

// ─── Worker Lifecycle ──────────────────────────────────────────────

export async function startDailyReportWorker(): Promise<{
  queue: Queue;
  worker: Worker;
}> {
  const queue = new Queue(QUEUE_NAME, {
    connection: createRedisConnection(),
  });

  // Run every hour to check per-user scheduled times
  await queue.upsertJobScheduler(
    "daily-report-scheduler",
    { pattern: "0 * * * *", tz: "UTC" },
    { name: "daily-report", data: {} },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === "daily-report") {
        logger.info("Running daily report processing");
        await processDailyReports();
        logger.info("Daily report processing complete");
      }
    },
    { connection: createRedisConnection() },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Daily report job failed");
  });

  logger.info("Daily report worker started (hourly check, per-user timezone)");

  return { queue, worker };
}
