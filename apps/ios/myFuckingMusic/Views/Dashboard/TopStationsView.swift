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
                .padding(.horizontal)

            if displayStations.isEmpty {
                Text("No station data")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 100)
            } else {
                Chart(displayStations) { station in
                    BarMark(
                        x: .value("Plays", station.playCount),
                        y: .value("Station", station.stationName)
                    )
                    .foregroundStyle(.blue.gradient)
                    .annotation(position: .trailing, alignment: .leading, spacing: 4) {
                        Text("\(station.playCount)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .chartYAxis {
                    AxisMarks { _ in
                        AxisValueLabel()
                    }
                }
                .chartXAxis {
                    AxisMarks(position: .bottom)
                }
                .frame(height: CGFloat(displayStations.count * 44))
                .padding(.horizontal)
            }
        }
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
}
