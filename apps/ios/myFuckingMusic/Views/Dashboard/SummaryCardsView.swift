import SwiftUI

/// Horizontal row of summary cards showing total plays, unique songs, and unique artists.
/// Shows "--" placeholders when data is not yet loaded.
struct SummaryCardsView: View {
    let totals: PlayCountTotals?

    var body: some View {
        HStack(spacing: 12) {
            SummaryCard(
                title: "Plays",
                value: totals.map { "\($0.playCount)" } ?? "--",
                icon: "play.circle.fill",
                color: .blue
            )

            SummaryCard(
                title: "Songs",
                value: totals.map { "\($0.uniqueSongs)" } ?? "--",
                icon: "music.note",
                color: .purple
            )

            SummaryCard(
                title: "Artists",
                value: totals.map { "\($0.uniqueArtists)" } ?? "--",
                icon: "person.2.fill",
                color: .orange
            )
        }
        .padding(.horizontal)
    }
}

/// Individual summary card with a bold number, label, and icon.
private struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundStyle(.primary)

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.background)
                .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
        )
    }
}

#Preview {
    SummaryCardsView(totals: PlayCountTotals(playCount: 142, uniqueSongs: 38, uniqueArtists: 12))
        .padding()
}
