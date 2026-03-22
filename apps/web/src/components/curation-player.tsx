"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import Link from "next/link";

interface CurationSong {
  id: number;
  songTitle: string;
  artistName: string;
  coverUrl: string;
  artistPhotoUrl: string | null;
  previewUrl: string | null;
  deezerTrackId: string | null;
}

interface VoteResponse {
  keeperPercent: number;
  skipperPercent: number;
  totalVotes: number;
}

function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("mfm_curation_session");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("mfm_curation_session", token);
  }
  return token;
}

export function CurationPlayer({
  stationId,
  stationName,
  showBranding = false,
}: {
  stationId: string;
  stationName?: string;
  showBranding?: boolean;
}) {
  const [song, setSong] = useState<CurationSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteResult, setVoteResult] = useState<VoteResponse | null>(null);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dominantColor, setDominantColor] = useState("rgb(39, 39, 42)");

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setVoteResult(null);
    setSwipeDir(null);
    setProgress(0);
    setIsPlaying(false);
    setError(null);

    try {
      const sessionToken = getSessionToken();
      const data = await apiFetch<CurationSong | { done: true }>(
        `/curation/stations/${stationId}/next?sessionToken=${sessionToken}`
      );

      if ("done" in data) {
        setEmpty(true);
        setSong(null);
      } else {
        setSong(data);
        setEmpty(false);
        extractColor(data.coverUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load song");
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  // Auto-play when song changes
  useEffect(() => {
    if (song?.previewUrl && audioRef.current) {
      audioRef.current.src = song.previewUrl;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [song]);

  // Progress tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(100);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function extractColor(url: string) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0;
        const count = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        setDominantColor(`rgb(${r}, ${g}, ${b})`);
      } catch {
        // CORS or canvas error — keep default
      }
    };
    img.src = url;
  }

  async function handleVote(vote: "KEEPER" | "SKIPPER") {
    if (!song) return;

    setSwipeDir(vote === "KEEPER" ? "right" : "left");

    try {
      const sessionToken = getSessionToken();
      const result = await apiFetch<VoteResponse>("/curation/vote", {
        method: "POST",
        body: JSON.stringify({
          curationSongId: song.id,
          vote,
          sessionToken,
        }),
      });
      setVoteResult(result);
    } catch {
      // vote failed silently, still advance
    }

    // Brief pause to show animation, then next
    setTimeout(() => {
      fetchNext();
    }, 800);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }

  // Empty state
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-4">&#127942;</div>
        <h2 className="text-2xl font-bold text-white mb-2">You voted on all songs!</h2>
        <p className="text-zinc-400 mb-6">Check the leaderboard to see how songs rank.</p>
        <Link
          href={`/curation/${stationId}/leaderboard`}
          className="px-6 py-3 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
        >
          View Leaderboard
        </Link>
        {showBranding && (
          <a
            href="https://myfuckingmusic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Powered by myFuckingMusic
          </a>
        )}
      </div>
    );
  }

  // Loading
  if (loading && !song) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading next song...
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-6">
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchNext}
            className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm hover:bg-zinc-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!song) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 w-full">
      {/* Background glow */}
      <div
        className="fixed inset-0 -z-10 opacity-30 transition-colors duration-700"
        style={{
          background: `radial-gradient(ellipse at center, ${dominantColor} 0%, transparent 70%)`,
        }}
      />

      {/* Station name */}
      {stationName && (
        <p className="text-sm text-zinc-500 font-medium uppercase tracking-wider mb-4">
          {stationName}
        </p>
      )}

      {/* Audio element */}
      <audio ref={audioRef} preload="auto" />

      {/* Song card */}
      <div
        className={cn(
          "relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transition-all duration-500",
          swipeDir === "right" && "translate-x-[120%] rotate-12 opacity-0",
          swipeDir === "left" && "-translate-x-[120%] -rotate-12 opacity-0",
          !swipeDir && "translate-x-0 rotate-0 opacity-100"
        )}
      >
        {/* Cover art */}
        <div className="relative aspect-square w-full">
          <img
            src={song.coverUrl}
            alt={song.songTitle}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Artist photo overlay */}
          {song.artistPhotoUrl && (
            <div className="absolute bottom-20 left-4">
              <img
                src={song.artistPhotoUrl}
                alt={song.artistName}
                className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shadow-lg"
              />
            </div>
          )}

          {/* Song info */}
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-xl font-bold text-white truncate drop-shadow-lg">
              {song.songTitle}
            </h2>
            <p className="text-sm text-white/70 truncate drop-shadow-lg">
              {song.artistName}
            </p>
          </div>

          {/* Play/pause button */}
          <button
            onClick={togglePlay}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Vote result flash */}
          {voteResult && swipeDir && (
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                swipeDir === "right" ? "bg-emerald-500/30" : "bg-red-500/30"
              )}
            >
              <div className="text-center">
                <p className="text-4xl font-black text-white drop-shadow-lg">
                  {swipeDir === "right" ? "KEEPER" : "SKIPPER"}
                </p>
                <p className="text-lg text-white/80 mt-1">
                  {voteResult.keeperPercent}% keep rate
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-zinc-800 w-full">
          <div
            className="h-full bg-white/60 transition-all duration-200 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Vote buttons */}
      <div className="flex items-center gap-6 mt-8">
        <button
          onClick={() => handleVote("SKIPPER")}
          disabled={!!swipeDir}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-all",
            "bg-red-500/20 border-2 border-red-500 text-red-400",
            "hover:bg-red-500/40 hover:scale-110 active:scale-95",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <button
          onClick={() => handleVote("KEEPER")}
          disabled={!!swipeDir}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-all",
            "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400",
            "hover:bg-emerald-500/40 hover:scale-110 active:scale-95",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Leaderboard link */}
      <Link
        href={`/curation/${stationId}/leaderboard`}
        className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors"
      >
        View Leaderboard
      </Link>

      {showBranding && (
        <a
          href="https://myfuckingmusic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Powered by myFuckingMusic
        </a>
      )}
    </div>
  );
}
