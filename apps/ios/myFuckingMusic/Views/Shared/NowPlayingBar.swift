import SwiftUI

/// Floating mini-player bar shown while a broadcast snippet plays.
struct NowPlayingBar: View {
    @Environment(AudioPlayerManager.self) private var player
    @State private var isSeeking = false
    @State private var seekProgress: Double = 0

    private let detectionPoint: Double = 25.0 / 30.0

    var body: some View {
        if player.currentlyPlayingId != nil && !player.isLoadingSnippet {
            VStack(spacing: 0) {
                // Seekable progress bar - tall touch target
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

                    detectionLabel

                    Button {
                        if player.isPlaying { player.pause() } else { player.resume() }
                    } label: {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.rbTextPrimary)
                            .frame(width: 32, height: 32)
                    }

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

    // MARK: - Seekable Progress Bar

    private var displayProgress: Double {
        isSeeking ? seekProgress : player.playbackProgress
    }

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                // Background
                Color.rbSurfaceLight

                // Progress fill - no animation while seeking
                Color.rbAccent
                    .frame(width: geo.size.width * CGFloat(displayProgress))

                // Detection marker
                Color.rbWarm
                    .frame(width: 2, height: isSeeking ? 20 : 14)
                    .offset(x: geo.size.width * CGFloat(detectionPoint) - 1)
            }
            // Large touch target, thin visual bar centered vertically
            .frame(height: isSeeking ? 20 : 4)
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if !isSeeking {
                            isSeeking = true
                            seekProgress = player.playbackProgress
                        }
                        seekProgress = min(max(value.location.x / geo.size.width, 0), 1)
                        player.seek(to: seekProgress)
                    }
                    .onEnded { _ in
                        isSeeking = false
                    }
            )
            .animation(.easeInOut(duration: 0.15), value: isSeeking)
        }
        .frame(height: 30) // Tall touch target area
    }

    // MARK: - Detection Label

    private var detectionLabel: some View {
        Group {
            if player.duration > 0 && displayProgress < detectionPoint {
                HStack(spacing: 4) {
                    Circle().fill(Color.rbWarm).frame(width: 5, height: 5)
                    Text("in \(secondsUntilDetection)s")
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
