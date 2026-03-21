import SwiftUI

/// Heatmap grid showing broadcast intensity across days (rows) and hours (columns).
/// 7 rows for days of the week, 24 columns for hours.
struct HourlyHeatmapView: View {
    let heatmap: HourlyHeatmapResponse
    var accentColor: Color = .rbAccent

    private let dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Broadcast Heatmap")
                .font(.headline)
                .foregroundStyle(Color.rbTextPrimary)

            Text("Days x Hours")
                .font(.caption)
                .foregroundStyle(Color.rbTextTertiary)

            ScrollView(.horizontal, showsIndicators: false) {
                VStack(spacing: 2) {
                    // Hour labels row
                    HStack(spacing: 2) {
                        Text("")
                            .frame(width: 32)
                        ForEach(0..<24, id: \.self) { hour in
                            if hour % 3 == 0 {
                                Text("\(hour)")
                                    .font(.system(size: 8))
                                    .foregroundStyle(Color.rbTextTertiary)
                                    .frame(width: 14)
                            } else {
                                Spacer()
                                    .frame(width: 14)
                            }
                        }
                    }

                    // Data rows
                    ForEach(0..<7, id: \.self) { day in
                        HStack(spacing: 2) {
                            Text(dayLabels[day])
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(Color.rbTextSecondary)
                                .frame(width: 32, alignment: .trailing)

                            ForEach(0..<24, id: \.self) { hour in
                                let value = safeValue(day: day, hour: hour)
                                let intensity = heatmap.maxValue > 0
                                    ? Double(value) / Double(heatmap.maxValue) : 0

                                RoundedRectangle(cornerRadius: 2)
                                    .fill(cellColor(intensity: intensity))
                                    .frame(width: 14, height: 14)
                                    .overlay {
                                        if value > 0 {
                                            Text("\(value)")
                                                .font(.system(size: 6))
                                                .foregroundStyle(.white.opacity(intensity > 0.3 ? 0.9 : 0))
                                        }
                                    }
                            }
                        }
                    }
                }
            }

            // Legend
            HStack(spacing: 4) {
                Text("Less")
                    .font(.caption2)
                    .foregroundStyle(Color.rbTextTertiary)
                ForEach([0.0, 0.25, 0.5, 0.75, 1.0], id: \.self) { intensity in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(cellColor(intensity: intensity))
                        .frame(width: 12, height: 12)
                }
                Text("More")
                    .font(.caption2)
                    .foregroundStyle(Color.rbTextTertiary)
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

    // MARK: - Helpers

    private func safeValue(day: Int, hour: Int) -> Int {
        guard day < heatmap.matrix.count, hour < heatmap.matrix[day].count else { return 0 }
        return heatmap.matrix[day][hour]
    }

    private func cellColor(intensity: Double) -> Color {
        if intensity == 0 {
            return Color.rbSurfaceLight.opacity(0.3)
        }
        return accentColor.opacity(0.2 + intensity * 0.8)
    }
}

#Preview {
    HourlyHeatmapView(heatmap: HourlyHeatmapResponse(
        matrix: (0..<7).map { _ in (0..<24).map { _ in Int.random(in: 0...10) } },
        maxValue: 10
    ))
    .padding()
    .background(Color.rbBackground)
}
