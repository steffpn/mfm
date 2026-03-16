import SwiftUI
import Charts

/// Bar chart showing play count trend over the selected time period.
/// Uses Swift Charts framework (iOS 16+).
struct PlayCountChartView: View {
    let data: [PlayCountBucket]
    let period: TimePeriod

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Play Count Trend")
                .font(.headline)
                .padding(.horizontal)

            if data.isEmpty {
                Text("No data")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 200)
            } else {
                Chart(chartData, id: \.bucket) { item in
                    BarMark(
                        x: .value("Date", item.date),
                        y: .value("Plays", item.playCount)
                    )
                    .foregroundStyle(.blue.gradient)
                }
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisGridLine()
                        AxisValueLabel(format: xAxisFormat)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
                .frame(height: 200)
                .padding(.horizontal)
            }
        }
    }

    /// Filter buckets to only those with parseable dates.
    private var chartData: [(bucket: String, date: Date, playCount: Int)] {
        data.compactMap { bucket in
            guard let date = bucket.date else { return nil }
            return (bucket: bucket.bucket, date: date, playCount: bucket.playCount)
        }
    }

    /// X-axis date format based on the selected period.
    private var xAxisFormat: Date.FormatStyle {
        switch period {
        case .day:
            return .dateTime.hour()
        case .week:
            return .dateTime.weekday(.abbreviated)
        case .month:
            return .dateTime.day()
        }
    }
}

#Preview {
    PlayCountChartView(
        data: [
            PlayCountBucket(bucket: "2026-03-16T00:00:00Z", playCount: 12, uniqueSongs: 5, uniqueArtists: 3),
            PlayCountBucket(bucket: "2026-03-16T01:00:00Z", playCount: 8, uniqueSongs: 4, uniqueArtists: 2),
            PlayCountBucket(bucket: "2026-03-16T02:00:00Z", playCount: 15, uniqueSongs: 6, uniqueArtists: 4),
        ],
        period: .day
    )
    .padding()
}
