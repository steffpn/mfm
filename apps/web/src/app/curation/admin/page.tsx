"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/cn";

interface CurationStation {
  id: number;
  name: string;
  logoUrl: string | null;
  country: string | null;
  songCount: number;
}

interface CurationSong {
  id: number;
  songTitle: string;
  artistName: string;
  coverUrl: string;
  artistPhotoUrl: string | null;
  keeperPercent: number;
  totalVotes: number;
}

export default function CurationAdminPage() {
  const [stations, setStations] = useState<CurationStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [songs, setSongs] = useState<CurationSong[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [embedModal, setEmbedModal] = useState<CurationStation | null>(null);

  const fetchStations = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("Not authenticated. Please log in.");
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<CurationStation[]>("/curation/stations", { token });
      setStations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  async function loadSongs(stationId: number) {
    setSelectedStation(stationId);
    setSongsLoading(true);
    try {
      const data = await apiFetch<CurationSong[]>(
        `/curation/scores?stationId=${stationId}`,
        { token: getToken() || undefined }
      );
      setSongs(data);
    } catch {
      setSongs([]);
    } finally {
      setSongsLoading(false);
    }
  }

  async function syncRotation(stationId: number) {
    const token = getToken();
    if (!token) return;
    setSyncing(stationId);
    try {
      await apiFetch(`/curation/stations/${stationId}/sync-rotation`, {
        method: "POST",
        token,
      });
      fetchStations();
      if (selectedStation === stationId) {
        loadSongs(stationId);
      }
    } catch {
      // sync failed
    } finally {
      setSyncing(null);
    }
  }

  function getEmbedCode(station: CurationStation): string {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `<iframe
  src="${baseUrl}/embed/curation/${station.id}"
  width="400"
  height="700"
  frameborder="0"
  allow="autoplay"
  style="border-radius: 16px; border: none;"
></iframe>`;
  }

  function getJsSdkSnippet(station: CurationStation): string {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `<div id="mfm-curation"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${baseUrl}/embed/curation/${station.id}';
    iframe.width = '400';
    iframe.height = '700';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay';
    iframe.style.borderRadius = '16px';
    iframe.style.border = 'none';
    document.getElementById('mfm-curation').appendChild(iframe);
  })();
</script>`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Curation Admin</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage song curation per station, sync rotations, and get embed codes.
          </p>
        </div>
      </div>

      {/* Stations grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {stations.map((station) => (
          <div
            key={station.id}
            className={cn(
              "p-5 rounded-xl border transition-colors",
              selectedStation === station.id
                ? "bg-zinc-800/60 border-zinc-600"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <div className="flex items-start gap-4">
              {station.logoUrl ? (
                <img
                  src={station.logoUrl}
                  alt={station.name}
                  className="w-12 h-12 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{station.name}</h3>
                <p className="text-xs text-zinc-500">
                  {station.country || "Unknown country"} &middot; {station.songCount} songs
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => syncRotation(station.id)}
                disabled={syncing === station.id}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                  "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white",
                  syncing === station.id && "opacity-50 cursor-not-allowed"
                )}
              >
                {syncing === station.id ? "Syncing..." : "Sync from Rotation"}
              </button>
              <button
                onClick={() => loadSongs(station.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                View Songs
              </button>
              <button
                onClick={() => setEmbedModal(station)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Embed Code
              </button>
              <a
                href={`/curation/${station.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Open
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Song list for selected station */}
      {selectedStation && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="font-semibold text-white">
              Songs — {stations.find((s) => s.id === selectedStation)?.name}
            </h2>
          </div>

          {songsLoading ? (
            <div className="py-12 text-center text-zinc-500">Loading songs...</div>
          ) : songs.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              No songs yet. Sync from rotation to populate.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {songs.map((song) => (
                <div key={song.id} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                  <div className="relative flex-shrink-0">
                    <img
                      src={song.coverUrl}
                      alt={song.songTitle}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    {song.artistPhotoUrl && (
                      <img
                        src={song.artistPhotoUrl}
                        alt={song.artistName}
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover border border-zinc-900"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{song.songTitle}</p>
                    <p className="text-xs text-zinc-500 truncate">{song.artistName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {song.totalVotes > 0 ? (
                      <>
                        <p className={cn(
                          "text-sm font-bold",
                          song.keeperPercent >= 70 ? "text-emerald-400" :
                          song.keeperPercent >= 40 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {song.keeperPercent}%
                        </p>
                        <p className="text-[10px] text-zinc-600">{song.totalVotes} votes</p>
                      </>
                    ) : (
                      <p className="text-xs text-zinc-600">No votes</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Embed modal */}
      {embedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">
                Embed — {embedModal.name}
              </h3>
              <button
                onClick={() => setEmbedModal(null)}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* iframe embed */}
            <div className="mb-6">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                iframe Embed
              </label>
              <pre className="mt-2 p-3 bg-zinc-800 rounded-lg text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                {getEmbedCode(embedModal)}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(getEmbedCode(embedModal))}
                className="mt-2 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Copy iframe
              </button>
            </div>

            {/* JS SDK snippet */}
            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                JS SDK Snippet
              </label>
              <pre className="mt-2 p-3 bg-zinc-800 rounded-lg text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                {getJsSdkSnippet(embedModal)}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(getJsSdkSnippet(embedModal))}
                className="mt-2 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Copy JS snippet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
