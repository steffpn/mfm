"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import Link from "next/link";

interface LeaderboardEntry {
  id: number;
  songTitle: string;
  artistName: string;
  coverUrl: string;
  artistPhotoUrl: string | null;
  keeperPercent: number;
  skipperPercent: number;
  totalVotes: number;
}

export function CurationLeaderboard({
  stationId,
  stationName,
  showBranding = false,
}: {
  stationId: string;
  stationName?: string;
  showBranding?: boolean;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<LeaderboardEntry[]>(
          `/curation/scores?stationId=${stationId}`
        );
        setEntries(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [stationId]);

  function getScoreColor(percent: number): string {
    if (percent >= 70) return "text-emerald-400";
    if (percent >= 40) return "text-yellow-400";
    return "text-red-400";
  }

  function getScoreBarColor(percent: number): string {
    if (percent >= 70) return "bg-emerald-500";
    if (percent >= 40) return "bg-yellow-500";
    return "bg-red-500";
  }

  function getMedalEmoji(pos: number): string {
    if (pos === 1) return "\u{1F947}";
    if (pos === 2) return "\u{1F948}";
    if (pos === 3) return "\u{1F949}";
    return "";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading leaderboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 px-4">
        <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-3">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        {stationName && (
          <p className="text-sm text-zinc-500 mt-1">{stationName}</p>
        )}
        <p className="text-xs text-zinc-600 mt-2">
          {entries.length} songs ranked by keeper rate
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="mb-2">No votes yet.</p>
          <Link
            href={`/curation/${stationId}`}
            className="text-sm text-white hover:underline"
          >
            Be the first to vote
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            const position = idx + 1;
            const medal = getMedalEmoji(position);

            return (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-xl transition-colors",
                  "bg-zinc-900/80 border border-zinc-800/50",
                  position <= 3 && "border-zinc-700/50"
                )}
              >
                {/* Position */}
                <div className="w-10 text-center flex-shrink-0">
                  {medal ? (
                    <span className="text-xl">{medal}</span>
                  ) : (
                    <span className="text-sm font-bold text-zinc-500">
                      {position}
                    </span>
                  )}
                </div>

                {/* Cover + artist photo */}
                <div className="relative flex-shrink-0">
                  <img
                    src={entry.coverUrl}
                    alt={entry.songTitle}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  {entry.artistPhotoUrl && (
                    <img
                      src={entry.artistPhotoUrl}
                      alt={entry.artistName}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full object-cover border border-zinc-900"
                    />
                  )}
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {entry.songTitle}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {entry.artistName}
                  </p>
                  {/* Score bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          getScoreBarColor(entry.keeperPercent)
                        )}
                        style={{ width: `${entry.keeperPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-lg font-bold", getScoreColor(entry.keeperPercent))}>
                    {entry.keeperPercent}%
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {entry.totalVotes} vote{entry.totalVotes !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Back to voting */}
      <div className="text-center mt-8">
        <Link
          href={`/curation/${stationId}`}
          className="text-sm text-zinc-500 hover:text-white transition-colors"
        >
          Back to voting
        </Link>
      </div>

      {showBranding && (
        <div className="text-center mt-6">
          <a
            href="https://myfuckingmusic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Powered by myFuckingMusic
          </a>
        </div>
      )}
    </div>
  );
}
