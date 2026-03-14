-- Add acrcloudStreamId to stations (required, unique)
ALTER TABLE "stations" ADD COLUMN "acrcloud_stream_id" TEXT NOT NULL DEFAULT '';
-- Assign unique placeholder values to existing rows so unique index can be created
UPDATE "stations" SET "acrcloud_stream_id" = 'placeholder-' || "id" WHERE "acrcloud_stream_id" = '';
CREATE UNIQUE INDEX "stations_acrcloud_stream_id_key" ON "stations"("acrcloud_stream_id");
-- Remove the default after migration (column is required going forward)
ALTER TABLE "stations" ALTER COLUMN "acrcloud_stream_id" DROP DEFAULT;

-- Add confidence to airplay_events
ALTER TABLE "airplay_events" ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create no_match_callbacks table
CREATE TABLE "no_match_callbacks" (
  "id" SERIAL NOT NULL,
  "station_id" INTEGER NOT NULL,
  "callback_at" TIMESTAMP(3) NOT NULL,
  "status_code" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "no_match_callbacks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "no_match_callbacks_station_id_callback_at_idx" ON "no_match_callbacks"("station_id", "callback_at");
CREATE INDEX "no_match_callbacks_created_at_idx" ON "no_match_callbacks"("created_at");

-- Add foreign key constraint for no_match_callbacks -> stations
ALTER TABLE "no_match_callbacks" ADD CONSTRAINT "no_match_callbacks_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
