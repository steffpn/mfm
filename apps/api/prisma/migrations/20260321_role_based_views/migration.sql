-- Add logo_url to stations
ALTER TABLE "stations" ADD COLUMN "logo_url" TEXT;

-- Create monitored_songs table
CREATE TABLE "monitored_songs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "song_title" TEXT NOT NULL,
    "artist_name" TEXT NOT NULL,
    "isrc" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "monitored_songs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monitored_songs_user_id_isrc_key" ON "monitored_songs"("user_id", "isrc");
CREATE INDEX "monitored_songs_user_id_status_idx" ON "monitored_songs"("user_id", "status");
CREATE INDEX "monitored_songs_isrc_idx" ON "monitored_songs"("isrc");

ALTER TABLE "monitored_songs"
  ADD CONSTRAINT "monitored_songs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create label_artists table
CREATE TABLE "label_artists" (
    "id" SERIAL NOT NULL,
    "label_user_id" INTEGER NOT NULL,
    "artist_user_id" INTEGER,
    "artist_name" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "label_artists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "label_artists_label_user_id_artist_name_key" ON "label_artists"("label_user_id", "artist_name");
CREATE INDEX "label_artists_label_user_id_idx" ON "label_artists"("label_user_id");

ALTER TABLE "label_artists"
  ADD CONSTRAINT "label_artists_label_user_id_fkey"
  FOREIGN KEY ("label_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "label_artists"
  ADD CONSTRAINT "label_artists_artist_user_id_fkey"
  FOREIGN KEY ("artist_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create label_monitored_songs table
CREATE TABLE "label_monitored_songs" (
    "id" SERIAL NOT NULL,
    "label_artist_id" INTEGER NOT NULL,
    "monitored_song_id" INTEGER NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "label_monitored_songs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "label_monitored_songs_label_artist_id_monitored_song_id_key" ON "label_monitored_songs"("label_artist_id", "monitored_song_id");

ALTER TABLE "label_monitored_songs"
  ADD CONSTRAINT "label_monitored_songs_label_artist_id_fkey"
  FOREIGN KEY ("label_artist_id") REFERENCES "label_artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "label_monitored_songs"
  ADD CONSTRAINT "label_monitored_songs_monitored_song_id_fkey"
  FOREIGN KEY ("monitored_song_id") REFERENCES "monitored_songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
