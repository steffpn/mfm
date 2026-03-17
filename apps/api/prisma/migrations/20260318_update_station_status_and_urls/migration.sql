-- Update station status to uppercase ACTIVE (supervisor expects uppercase)
UPDATE stations SET status = 'ACTIVE' WHERE status = 'active';

-- Update stream URLs to real radio stream URLs
UPDATE stations SET stream_url = 'https://astreaming.edi-static.net/virginradio_ro/virginradio_ro.aac' WHERE acrcloud_stream_id = '222987';
UPDATE stations SET stream_url = 'https://live.kissfm.ro/kissfm.aacp' WHERE acrcloud_stream_id = '190589';
