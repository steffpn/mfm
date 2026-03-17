import SwiftUI

/// Horizontal row of summary cards showing total plays, unique songs, and unique artists.
/// Shows "--" placeholders when data is not yet loaded.
/// Each card is tappable with a press effect; callbacks notify the parent of taps.
struct SummaryCardsView: View {
    let totals: PlayCountTotals?
    var onPlaysTapped: (() -> Void)? = nil
    var onSongsTapped: (() -> Void)? = nil
    var onArtistsTapped: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 12) {
            SummaryCard(
                title: "Plays",
                value: totals.map { "\($0.playCount)" } ?? "--",
                icon: "play.circle.fill",
                color: .rbAccent,
                onTap: onPlaysTapped
            )

            SummaryCard(
                title: "Songs",
                value: totals.map { "\($0.uniqueSongs)" } ?? "--",
                icon: "music.note",
                color: .purple,
                onTap: onSongsTapped
            )

            SummaryCard(
                title: "Artists",
                value: totals.map { "\($0.uniqueArtists)" } ?? "--",
                icon: "person.2.fill",
                color: .rbWarm,
                onTap: onArtistsTapped
            )
        }
        .padding(.horizontal)
    }
}

/// Individual summary card with a bold number, label, and icon.
/// Supports a tap gesture with a subtle scale-down press effect.
private struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    var onTap: (() -> Void)? = nil

    @State private var isPressed = false

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundStyle(Color.rbTextPrimary)

            Text(title)
                .font(.caption)
                .foregroundStyle(Color.rbTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.rbSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.rbSurfaceLight, lineWidth: 1)
        )
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .animation(.easeInOut(duration: 0.15), value: isPressed)
        .onTapGesture {
            onTap?()
        }
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
    }
}

#Preview {
    SummaryCardsView(
        totals: PlayCountTotals(playCount: 142, uniqueSongs: 38, uniqueArtists: 12),
        onPlaysTapped: { print("Plays tapped") },
        onSongsTapped: { print("Songs tapped") },
        onArtistsTapped: { print("Artists tapped") }
    )
    .padding()
    .background(Color.rbBackground)
}
