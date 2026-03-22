"use client";

import { cn } from "@/lib/cn";

const PLATFORMS = [
  {
    name: "Shazam",
    description: "Top 200 charts per country, updated daily",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10 border-blue-400/20",
    enabled: true,
  },
  {
    name: "Spotify",
    description: "Top 50 and Viral 50 charts per country, updated daily",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10 border-emerald-400/20",
    enabled: true,
  },
  {
    name: "Apple Music",
    description: "Top 100 charts per country, updated daily",
    color: "text-pink-400",
    bgColor: "bg-pink-400/10 border-pink-400/20",
    enabled: true,
  },
];

const MONITORED_COUNTRIES = [
  { code: "RO", name: "Romania" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "GLOBAL", name: "Global" },
];

export default function ChartsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Chart Alerts</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor chart positions across platforms and receive alerts for tracked artists
        </p>
      </div>

      {/* Cron info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Daily Cron Job</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Chart data is scraped daily via a scheduled cron job. The scraper fetches chart positions
              from all enabled platforms, compares against tracked artists, and sends push notification
              alerts when an artist enters, exits, or moves on a chart.
            </p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-xs font-mono text-zinc-600 bg-zinc-800 px-2 py-1 rounded">
                Schedule: 0 6 * * * (daily at 06:00 UTC)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Platforms */}
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
        Monitored Platforms
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.name}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn("text-lg font-semibold", platform.color)}>
                {platform.name}
              </h3>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full border",
                  platform.enabled
                    ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                    : "bg-zinc-400/10 text-zinc-400 border-zinc-400/20"
                )}
              >
                {platform.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-sm text-zinc-400">{platform.description}</p>
          </div>
        ))}
      </div>

      {/* Monitored countries */}
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
        Monitored Countries
      </h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
        <div className="flex flex-wrap gap-2">
          {MONITORED_COUNTRIES.map((country) => (
            <span
              key={country.code}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg"
            >
              <span className="text-xs font-mono text-zinc-500">{country.code}</span>
              {country.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-zinc-600 mt-4">
          Country configuration is managed via the API. A dedicated admin endpoint for chart management is planned.
        </p>
      </div>

      {/* Alert types */}
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
        Alert Types
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">New Entry</h3>
          <p className="text-xs text-zinc-500">
            Triggered when a tracked artist first appears on a chart
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Position Change</h3>
          <p className="text-xs text-zinc-500">
            Triggered when a tracked artist moves up or down on a chart
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="w-8 h-8 rounded-lg bg-red-400/10 border border-red-400/20 flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Dropped Off</h3>
          <p className="text-xs text-zinc-500">
            Triggered when a tracked artist falls off a chart entirely
          </p>
        </div>
      </div>

      {/* Placeholder for future admin endpoint */}
      <div className="bg-zinc-800/30 border border-dashed border-zinc-700 rounded-xl p-8 text-center">
        <p className="text-sm text-zinc-500">
          A dedicated admin endpoint for viewing recent chart scrapes and managing alert configurations
          is in development. Chart data is currently managed through the API and daily cron job.
        </p>
      </div>
    </div>
  );
}
