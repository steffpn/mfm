import SwiftUI
import Charts

/// Horizontal bar chart showing top stations ranked by play count.
/// Uses Swift Charts framework (iOS 16+).
struct TopStationsView: View {
    let stations: [StationPlayCount]

    /// Maximum 10 stations displayed.
    private var displayStations: [StationPlayCount] {
        Array(stations.prefix(10))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Top Stations")
                .font(.headline)
                .foregroundStyle(Color.rbTextPrimary)
                .padding(.horizontal)

            if displayStations.isEmpty {
                Text("No station data")
                    .foregroundStyle(Color.rbTextTertiary)
                    .frame(maxWidth: .infinity, minHeight: 100)
            } else {
                Chart(displayStations) { station in
                    BarMark(
                        x: .value("Plays", station.playCount),
                        y: .value("Station", station.stationName)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.rbAccent, .rbAccentDark],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(4)
                    .annotation(position: .trailing, alignment: .leading, spacing: 4) {
                        Text("\(station.playCount)")
                            .font(.caption)
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                }
                .chartYAxis {
                    AxisMarks { _ in
                        AxisValueLabel()
                            .foregroundStyle(Color.rbTextPrimary)
                    }
                }
                .chartXAxis {
                    AxisMarks(position: .bottom) { _ in
                        AxisGridLine()
                            .foregroundStyle(Color.rbSurfaceLight)
                        AxisValueLabel()
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                }
                .chartPlotStyle { plotArea in
                    plotArea
                        .background(Color.rbSurface.opacity(0.3))
                }
                .frame(height: CGFloat(displayStations.count * 44))
                .padding(.horizontal)
            }
        }
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.rbSurface)
        )
        .padding(.horizontal)
    }
}

#Preview {
    TopStationsView(stations: [
        StationPlayCount(stationId: 1, stationName: "Kiss FM", playCount: 45),
        StationPlayCount(stationId: 2, stationName: "Europa FM", playCount: 38),
        StationPlayCount(stationId: 3, stationName: "Radio ZU", playCount: 27),
        StationPlayCount(stationId: 4, stationName: "Pro FM", playCount: 19),
        StationPlayCount(stationId: 5, stationName: "Radio 21", playCount: 11),
    ])
    .padding()
    .background(Color.rbBackground)
}
