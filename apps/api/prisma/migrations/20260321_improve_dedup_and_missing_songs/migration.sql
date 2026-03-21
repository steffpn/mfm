-- Add indexes to airplay_events for dedup performance
CREATE INDEX IF NOT EXISTS "airplay_events_station_id_isrc_ended_at_idx"
  ON "airplay_events"("station_id", "isrc", "ended_at");

CREATE INDEX IF NOT EXISTS "airplay_events_station_id_ended_at_idx"
  ON "airplay_events"("station_id", "ended_at");

CREATE INDEX IF NOT EXISTS "airplay_events_isrc_started_at_idx"
  ON "airplay_events"("isrc", "started_at");

-- Create missing_song_reports table
CREATE TABLE "missing_song_reports" (
    "id" SERIAL NOT NULL,
    "song_title" TEXT NOT NULL,
    "artist_name" TEXT NOT NULL,
    "isrc" TEXT,
    "youtube_url" TEXT,
    "spotify_url" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reported_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missing_song_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "missing_song_reports_status_idx" ON "missing_song_reports"("status");
CREATE INDEX "missing_song_reports_reported_by_idx" ON "missing_song_reports"("reported_by");

ALTER TABLE "missing_song_reports"
  ADD CONSTRAINT "missing_song_reports_reported_by_fkey"
  FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
