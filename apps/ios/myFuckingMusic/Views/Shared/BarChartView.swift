import SwiftUI
import Charts

/// Bar chart for daily play counts. Spotify Wrapped style with rounded gradient bars.
struct BarChartView: View {
    let data: [DayPlayCount]
    var accentColor: Color = .rbAccent
    var title: String = "Daily Plays"

    private var maxCount: Int {
        data.map(\.count).max() ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.rbTextPrimary)

            if data.isEmpty {
                Text("No data available")
                    .font(.subheadline)
                    .foregroundStyle(Color.rbTextTertiary)
                    .frame(maxWidth: .infinity, minHeight: 200, alignment: .center)
            } else {
                Chart(data) { item in
                    BarMark(
                        x: .value("Date", item.shortDate),
                        y: .value("Plays", item.count)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [accentColor, accentColor.opacity(0.6)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .cornerRadius(4)
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { _ in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            .foregroundStyle(Color.rbSurfaceLight)
                        AxisValueLabel()
                            .foregroundStyle(Color.rbTextTertiary)
                    }
                }
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel()
                            .foregroundStyle(Color.rbTextTertiary)
                    }
                }
                .chartPlotStyle { plotArea in
                    plotArea
                        .background(Color.rbSurface.opacity(0.3))
                }
                .frame(height: 200)
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
}

// MARK: - DayPlayCount Short Date

extension DayPlayCount {
    /// Convert "2026-03-18" to "18/03" for compact chart labels.
    var shortDate: String {
        let parts = date.split(separator: "-")
        guard parts.count == 3 else { return date }
        return "\(parts[2])/\(parts[1])"
    }
}

#Preview {
    BarChartView(data: [
        DayPlayCount(date: "2026-03-14", count: 12),
        DayPlayCount(date: "2026-03-15", count: 8),
        DayPlayCount(date: "2026-03-16", count: 22),
        DayPlayCount(date: "2026-03-17", count: 15),
        DayPlayCount(date: "2026-03-18", count: 30),
    ])
    .padding()
    .background(Color.rbBackground)
}
