/**
 * Seed script for plans and features.
 * Run: npx tsx prisma/seed-plans.ts
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const FEATURES = [
  // Analytics
  { key: "analytics.basic_stats", name: "Basic Play Stats", description: "View total play counts and basic charts", category: "analytics", roles: ["ARTIST", "LABEL", "STATION"] },
  { key: "analytics.detailed_breakdown", name: "Detailed Station Breakdown", description: "See play-by-play breakdown per station with peak hours", category: "analytics", roles: ["ARTIST", "LABEL"] },
  { key: "analytics.hourly_heatmap", name: "Hourly Heatmap", description: "7x24 hour heatmap showing when your songs play most", category: "analytics", roles: ["ARTIST", "LABEL"] },
  { key: "analytics.trend_comparison", name: "Trend Comparison", description: "This week vs last week performance comparison", category: "analytics", roles: ["ARTIST", "LABEL"] },
  { key: "analytics.peak_hours", name: "Peak Hours Analysis", description: "Top 5 busiest hours for your songs", category: "analytics", roles: ["ARTIST", "LABEL"] },
  { key: "analytics.competitor_intel", name: "Competitor Intelligence", description: "Detailed competitor analysis with overlap and exclusive songs", category: "analytics", roles: ["STATION"] },
  { key: "analytics.rotation_analysis", name: "Rotation Analysis", description: "Over-rotation detection and rotation health", category: "analytics", roles: ["STATION"] },
  { key: "analytics.discovery_score", name: "Discovery Score", description: "New song discovery percentage and metrics", category: "analytics", roles: ["STATION"] },
  { key: "analytics.genre_distribution", name: "Genre Distribution", description: "Label and genre breakdown of your playlist", category: "analytics", roles: ["STATION"] },

  // Label-specific
  { key: "label.artist_comparison", name: "Artist Comparison", description: "Compare performance across your roster", category: "label", roles: ["LABEL"] },
  { key: "label.station_affinity", name: "Station Affinity Report", description: "See which stations play your artists most", category: "label", roles: ["LABEL"] },
  { key: "label.release_tracker", name: "Release Tracker", description: "Track new release performance over time", category: "label", roles: ["LABEL"] },
  { key: "label.unlimited_artists", name: "Unlimited Artists", description: "Monitor unlimited artists (free: up to 3)", category: "label", roles: ["LABEL"] },

  // Exports
  { key: "exports.csv", name: "CSV Export", description: "Export airplay data as CSV", category: "exports", roles: ["ARTIST", "LABEL", "STATION"] },
  { key: "exports.pdf", name: "PDF Reports", description: "Generate branded PDF reports", category: "exports", roles: ["ARTIST", "LABEL", "STATION"] },

  // Reports & Engagement
  { key: "reports.daily_basic", name: "Daily Report (Basic)", description: "Daily summary with generic tips", category: "reports", roles: ["ARTIST", "LABEL", "STATION"] },
  { key: "reports.daily_premium", name: "Daily Report (Premium)", description: "Detailed daily report with actionable, tailored insights", category: "reports", roles: ["ARTIST", "LABEL", "STATION"] },
  { key: "reports.weekly_digest", name: "Weekly Digest", description: "Weekly performance summary", category: "reports", roles: ["ARTIST", "LABEL", "STATION"] },

  // Curation
  { key: "curation.embed_widget", name: "Curation Embed Widget", description: "Embed song curation on your website", category: "curation", roles: ["STATION"] },
  { key: "curation.leaderboard", name: "Curation Leaderboard", description: "View full song curation scores and rankings", category: "curation", roles: ["STATION"] },
  { key: "curation.manage_songs", name: "Manage Curation Songs", description: "Add/remove songs from curation and sync from rotation", category: "curation", roles: ["STATION"] },

  // Alerts
  { key: "alerts.chart_monitoring", name: "Chart Monitoring", description: "Get alerts when your songs enter Shazam/Spotify/Apple Music charts", category: "alerts", roles: ["ARTIST", "LABEL"] },
  { key: "alerts.push_notifications", name: "Push Notifications", description: "Real-time push notifications for important events", category: "alerts", roles: ["ARTIST", "LABEL", "STATION"] },

  // Live Feed
  { key: "live.feed", name: "Live Detection Feed", description: "Real-time SSE feed of song detections", category: "live", roles: ["ARTIST", "LABEL", "STATION"] },
  { key: "live.audio_snippets", name: "Audio Snippets", description: "Listen to 5-second audio snippets of detections", category: "live", roles: ["ARTIST", "LABEL", "STATION"] },

  // Monitored Songs
  { key: "songs.monitor_basic", name: "Monitor Songs (Basic)", description: "Monitor up to 5 songs", category: "songs", roles: ["ARTIST"] },
  { key: "songs.monitor_unlimited", name: "Monitor Songs (Unlimited)", description: "Monitor unlimited songs", category: "songs", roles: ["ARTIST"] },
];

const PLANS = [
  { name: "Artist Free", slug: "artist-free", role: "ARTIST", tier: "FREE", monthlyPriceCents: 0, annualPriceCents: 0, trialDays: 0 },
  { name: "Artist Premium", slug: "artist-premium", role: "ARTIST", tier: "PREMIUM", monthlyPriceCents: 1999, annualPriceCents: 19999, trialDays: 7 },
  { name: "Label Free", slug: "label-free", role: "LABEL", tier: "FREE", monthlyPriceCents: 0, annualPriceCents: 0, trialDays: 0 },
  { name: "Label Premium", slug: "label-premium", role: "LABEL", tier: "PREMIUM", monthlyPriceCents: 4999, annualPriceCents: 49999, trialDays: 7, perSeatPriceCents: 999, perSeatLabel: "per artist" },
  { name: "Station Free", slug: "station-free", role: "STATION", tier: "FREE", monthlyPriceCents: 0, annualPriceCents: 0, trialDays: 0 },
  { name: "Station Premium", slug: "station-premium", role: "STATION", tier: "PREMIUM", monthlyPriceCents: 7999, annualPriceCents: 79999, trialDays: 7 },
];

// Which features go in which plan tier (FREE = basic, PREMIUM = all)
const FREE_FEATURES: Record<string, string[]> = {
  ARTIST: [
    "analytics.basic_stats", "exports.csv", "reports.daily_basic",
    "reports.weekly_digest", "alerts.push_notifications", "live.feed",
    "songs.monitor_basic",
  ],
  LABEL: [
    "analytics.basic_stats", "exports.csv", "reports.daily_basic",
    "reports.weekly_digest", "alerts.push_notifications", "live.feed",
  ],
  STATION: [
    "analytics.basic_stats", "exports.csv", "reports.daily_basic",
    "reports.weekly_digest", "alerts.push_notifications", "live.feed",
  ],
};

async function main() {
  console.log("Seeding features...");

  // Create features
  for (const f of FEATURES) {
    await prisma.feature.upsert({
      where: { key: f.key },
      update: { name: f.name, description: f.description, category: f.category, roles: f.roles },
      create: f,
    });
  }
  console.log(`  ${FEATURES.length} features upserted`);

  // Create plans
  console.log("Seeding plans...");
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      update: { name: p.name, role: p.role, tier: p.tier, monthlyPriceCents: p.monthlyPriceCents, annualPriceCents: p.annualPriceCents, trialDays: p.trialDays, perSeatPriceCents: p.perSeatPriceCents || 0, perSeatLabel: p.perSeatLabel },
      create: p,
    });
  }
  console.log(`  ${PLANS.length} plans upserted`);

  // Assign features to plans
  console.log("Assigning features to plans...");
  const allFeatures = await prisma.feature.findMany();
  const allPlans = await prisma.plan.findMany();

  for (const plan of allPlans) {
    const applicableFeatures = allFeatures.filter((f) => f.roles.includes(plan.role));

    let featuresToAssign: typeof allFeatures;
    if (plan.tier === "PREMIUM") {
      // Premium gets ALL applicable features
      featuresToAssign = applicableFeatures;
    } else {
      // Free gets only the basic features
      const freeKeys = FREE_FEATURES[plan.role] || [];
      featuresToAssign = applicableFeatures.filter((f) => freeKeys.includes(f.key));
    }

    for (const feature of featuresToAssign) {
      await prisma.planFeature.upsert({
        where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
        update: {},
        create: { planId: plan.id, featureId: feature.id },
      });
    }
    console.log(`  ${plan.name}: ${featuresToAssign.length} features`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
