FROM node:20-bookworm-slim

# Install FFmpeg 7.x for stream recording
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create data directory for stream segments
RUN mkdir -p data/streams

# Copy and install handled by production deploy pipeline
# For local development: mount source code as volume
COPY . .

EXPOSE 3000
CMD ["node", "--import", "tsx", "src/index.ts"]
