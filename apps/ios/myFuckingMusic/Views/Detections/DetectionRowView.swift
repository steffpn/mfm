import SwiftUI

/// Compact row displaying a single airplay detection.
/// Shows song title, artist, station name, timestamp, and play button.
/// When playing, expands inline to show SnippetPlayerView with progress bar.
struct DetectionRowView: View {
    let event: AirplayEvent
    @Environment(AudioPlayerManager.self) private var audioPlayer

    /// Whether this row's snippet is the currently active one.
    private var isActiveRow: Bool {
        audioPlayer.currentlyPlayingId == event.id
    }

    var body: some View {
        VStack(spacing: 0) {
            // Main row content
            HStack(spacing: 12) {
                // Left: song info
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.songTitle)
                        .font(.headline)
                        .lineLimit(1)

                    Text(event.artistName)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)

                    if let stationName = event.station?.name {
                        Text(stationName)
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Right: timestamp + play button
                VStack(alignment: .trailing, spacing: 6) {
                    Text(DateFormatters.shortDateTime(event.startedAt))
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    playButton
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)

            // Inline expanded player (shown when this row is active)
            if isActiveRow {
                SnippetPlayerView(
                    playbackProgress: audioPlayer.playbackProgress,
                    isPlaying: audioPlayer.isPlaying,
                    currentTime: audioPlayer.currentTime,
                    duration: audioPlayer.duration,
                    onPlayPause: {
                        if audioPlayer.isPlaying {
                            audioPlayer.pause()
                        } else {
                            audioPlayer.resume()
                        }
                    },
                    onStop: {
                        audioPlayer.stop()
                    }
                )
            }
        }
        .animation(.easeInOut(duration: 0.2), value: audioPlayer.currentlyPlayingId)
    }

    // MARK: - Play Button

    @ViewBuilder
    private var playButton: some View {
        if event.snippetUrl == nil {
            // No snippet available: grayed out, disabled
            Image(systemName: "play.circle")
                .font(.system(size: 28))
                .foregroundStyle(.secondary)
                .opacity(0.3)
        } else if isActiveRow && audioPlayer.isLoadingSnippet {
            // Loading snippet URL
            ProgressView()
                .frame(width: 28, height: 28)
        } else if isActiveRow && audioPlayer.isPlaying {
            // Currently playing this row
            Button {
                Task { await audioPlayer.play(eventId: event.id) }
            } label: {
                Image(systemName: "pause.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.blue)
            }
            .buttonStyle(.plain)
        } else {
            // Has snippet, not playing (or paused)
            Button {
                Task { await audioPlayer.play(eventId: event.id) }
            } label: {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.blue)
            }
            .buttonStyle(.plain)
        }
    }
}
