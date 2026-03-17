-- Seed initial stations matching ACRCloud Broadcast Monitoring channels
INSERT INTO stations (name, stream_url, station_type, acrcloud_stream_id, country, status, updated_at)
VALUES
  ('Virgin Radio', 'ACRCloud provided stream URL', 'radio', '222987', 'RO', 'active', NOW()),
  ('Kiss FM Romania', 'ACRCloud provided stream URL', 'radio', '190589', 'RO', 'active', NOW())
ON CONFLICT (acrcloud_stream_id) DO NOTHING;
