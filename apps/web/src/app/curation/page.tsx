"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface CurationStation {
  id: number;
  name: string;
  logoUrl: string | null;
  country: string | null;
  songCount: number;
}

export default function CurationStationsPage() {
  const [stations, setStations] = useState<CurationStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<CurationStation[]>("/curation/stations");
        setStations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stations");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading stations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Song Curation</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Pick a station and swipe to vote on songs — Keeper or Skipper.
        </p>
      </div>

      {stations.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p>No stations with curation enabled yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((station) => (
            <Link
              key={station.id}
              href={`/curation/${station.id}`}
              className={cn(
                "group block p-6 rounded-xl border transition-all",
                "bg-zinc-900 border-zinc-800 hover:border-zinc-600",
                "hover:shadow-lg hover:shadow-zinc-900/50"
              )}
            >
              <div className="flex items-center gap-4">
                {station.logoUrl ? (
                  <img
                    src={station.logoUrl}
                    alt={station.name}
                    className="w-14 h-14 rounded-xl object-cover bg-zinc-800"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-white/90 truncate">
                    {station.name}
                  </h3>
                  {station.country && (
                    <p className="text-xs text-zinc-500 mt-0.5">{station.country}</p>
                  )}
                  <p className="text-xs text-zinc-600 mt-1">
                    {station.songCount} song{station.songCount !== 1 ? "s" : ""} to rate
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
