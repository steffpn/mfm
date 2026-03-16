import SwiftUI

/// Compact row displaying a single airplay detection.
/// Shows song title, artist, station name, timestamp, and play button.
struct DetectionRowView: View {
    let event: AirplayEvent
    var onPlay: (() -> Void)?

    var body: some View {
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

                Button {
                    onPlay?()
                } label: {
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(event.snippetUrl != nil ? .blue : .secondary)
                        .opacity(event.snippetUrl != nil ? 1.0 : 0.3)
                }
                .disabled(event.snippetUrl == nil)
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }
}
