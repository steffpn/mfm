import SwiftUI

/// Floating mini-player bar shown at the bottom of the screen while a broadcast snippet plays.
/// Shows smooth progress, song info, detection marker at 50% (15s mark), and controls.
struct NowPlayingBar: View {
    @Environment(AudioPlayerManager.self) private var player

    /// Detection happens at 25s into a 30s clip (5s before end)
    private let detectionPoint: Double = 25.0 / 30.0

    var body: some View {
        if player.currentlyPlayingId != nil && !player.isLoadingSnippet {
            VStack(spacing: 0) {
                // Progress bar with detection marker
                progressBar

                // Controls row
                HStack(spacing: 12) {
                    Image(systemName: "waveform")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.rbAccent)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Broadcast Proof")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.rbTextPrimary)

                        Text(timeLabel)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Color.rbTextTertiary)
                    }

                    Spacer()

                    // Detection status
                    detectionLabel

                    // Play/Pause
                    Button {
                        if player.isPlaying { player.pause() } else { player.resume() }
                    } label: {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.rbTextPrimary)
                            .frame(width: 32, height: 32)
                    }

                    // Stop
                    Button { player.stop() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.rbTextTertiary)
                            .frame(width: 28, height: 28)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
            .background(Color.rbSurface)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: - Progress Bar (smooth)

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                // Background
                Color.rbSurfaceLight

                // Smooth progress fill
                Color.rbAccent
                    .frame(width: geo.size.width * CGFloat(player.playbackProgress))
                    .animation(.linear(duration: 0.1), value: player.playbackProgress)

                // Detection marker (orange line at midpoint)
                Color.rbWarm
                    .frame(width: 2)
                    .offset(x: geo.size.width * CGFloat(detectionPoint) - 1)
            }
        }
        .frame(height: 3)
    }

    // MARK: - Detection Label

    private var detectionLabel: some View {
        Group {
            if player.duration > 0 && player.playbackProgress < detectionPoint {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.rbWarm)
                        .frame(width: 5, height: 5)
                    Text("Detected in \(secondsUntilDetection)s")
                        .font(.caption2)
                        .foregroundStyle(Color.rbWarm)
                }
            } else if player.duration > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.rbLive)
                    Text("Detected")
                        .font(.caption2)
                        .foregroundStyle(Color.rbLive)
                }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: player.playbackProgress >= detectionPoint)
    }

    // MARK: - Helpers

    private var timeLabel: String {
        let current = Int(player.currentTime)
        let total = Int(max(player.duration, 1))
        return String(format: "%d:%02d / %d:%02d", current / 60, current % 60, total / 60, total % 60)
    }

    private var secondsUntilDetection: Int {
        let detectionTime = player.duration * detectionPoint
        return max(0, Int(ceil(detectionTime - player.currentTime)))
    }
}
