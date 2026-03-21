import SwiftUI

/// Compact badge showing trend direction with percentage change.
/// Used in song lists and analytics views to indicate week-over-week performance.
struct TrendBadge: View {
    let direction: String  // "up", "down", "flat"
    let percentChange: Double
    var compact: Bool = false

    private var color: Color {
        switch direction {
        case "up": return .green
        case "down": return .red
        default: return .rbTextTertiary
        }
    }

    private var icon: String {
        switch direction {
        case "up": return "arrow.up.right"
        case "down": return "arrow.down.right"
        default: return "minus"
        }
    }

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: compact ? 8 : 10, weight: .bold))

            if !compact {
                Text(String(format: "%.0f%%", abs(percentChange)))
                    .font(.system(size: 11, weight: .semibold))
            }
        }
        .foregroundStyle(color)
        .padding(.horizontal, compact ? 5 : 8)
        .padding(.vertical, compact ? 3 : 4)
        .background(
            Capsule()
                .fill(color.opacity(0.15))
        )
    }
}

#Preview {
    HStack(spacing: 12) {
        TrendBadge(direction: "up", percentChange: 12.5)
        TrendBadge(direction: "down", percentChange: 8.3)
        TrendBadge(direction: "flat", percentChange: 0)
        TrendBadge(direction: "up", percentChange: 25, compact: true)
    }
    .padding()
    .background(Color.rbBackground)
}
