import SwiftUI

/// Inline expanded player shown below a detection row during snippet playback.
/// Displays a thin progress bar, play/pause button, time indicator, and stop button.
struct SnippetPlayerView: View {
    let playbackProgress: Double
    let isPlaying: Bool
    let currentTime: Double
    let duration: Double
    var onPlayPause: () -> Void
    var onStop: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            // Thin horizontal progress bar
            ProgressView(value: playbackProgress)
                .tint(Color.rbAccent)
                .scaleEffect(y: 0.5, anchor: .center)

            HStack(spacing: 12) {
                // Play/Pause button
                Button(action: onPlayPause) {
                    Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(Color.rbAccent)
                }
                .buttonStyle(.plain)

                // Time display: "0:02 / 0:05"
                Text("\(formatTime(currentTime)) / \(formatTime(duration))")
                    .font(.caption)
                    .foregroundStyle(Color.rbTextTertiary)
                    .monospacedDigit()

                Spacer()

                // Stop button (collapses the player)
                Button(action: onStop) {
                    Image(systemName: "xmark.circle")
                        .font(.system(size: 20))
                        .foregroundStyle(Color.rbTextSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 6)
        .frame(height: 40)
        .background(Color.rbSurface)
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    /// Format seconds as "M:SS".
    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite && seconds >= 0 else { return "0:00" }
        let totalSeconds = Int(seconds)
        let minutes = totalSeconds / 60
        let secs = totalSeconds % 60
        return "\(minutes):\(String(format: "%02d", secs))"
    }
}
