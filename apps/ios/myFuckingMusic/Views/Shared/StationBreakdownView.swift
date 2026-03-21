import SwiftUI

/// Horizontal bar chart showing play count breakdown by station.
/// Displays station logos (or fallback icons) with proportional progress bars.
struct StationBreakdownView: View {
    let stations: [StationBreakdownItem]

    private var maxPlays: Int {
        stations.map(\.playCount).max() ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Station Breakdown")
                .font(.headline)
                .foregroundStyle(Color.rbTextPrimary)

            if stations.isEmpty {
                Text("No station data")
                    .font(.subheadline)
                    .foregroundStyle(Color.rbTextTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                ForEach(stations) { station in
                    HStack(spacing: 12) {
                        // Station logo or fallback
                        Group {
                            if let logoUrl = station.logoUrl, let url = URL(string: logoUrl) {
                                AsyncImage(url: url) { image in
                                    image.resizable().scaledToFit()
                                } placeholder: {
                                    stationFallbackIcon
                                }
                            } else {
                                stationFallbackIcon
                            }
                        }
                        .frame(width: 32, height: 32)
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(station.stationName)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Color.rbTextPrimary)
                                    .lineLimit(1)

                                Spacer()

                                Text("\(station.playCount)")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(Color.rbAccent)
                            }

                            // Progress bar
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 3)
                                        .fill(Color.rbSurfaceLight.opacity(0.3))
                                        .frame(height: 6)

                                    RoundedRectangle(cornerRadius: 3)
                                        .fill(LinearGradient(
                                            colors: [.rbAccent, .rbAccent.opacity(0.6)],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        ))
                                        .frame(
                                            width: geo.size.width * CGFloat(station.playCount) / CGFloat(maxPlays),
                                            height: 6
                                        )
                                }
                            }
                            .frame(height: 6)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.6)
        )
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.rbSurface.opacity(0.5))
        )
    }

    private var stationFallbackIcon: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(Color.rbSurfaceLight)
            .overlay {
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.rbAccent.opacity(0.6))
            }
    }
}

#Preview {
    StationBreakdownView(stations: [
        StationBreakdownItem(stationId: 1, stationName: "Kiss FM", logoUrl: nil, playCount: 45),
        StationBreakdownItem(stationId: 2, stationName: "Europa FM", logoUrl: nil, playCount: 38),
        StationBreakdownItem(stationId: 3, stationName: "Radio ZU", logoUrl: nil, playCount: 27),
        StationBreakdownItem(stationId: 4, stationName: "Pro FM", logoUrl: nil, playCount: 12),
    ])
    .padding()
    .background(Color.rbBackground)
}
