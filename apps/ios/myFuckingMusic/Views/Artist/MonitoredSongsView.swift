import SwiftUI

/// List of songs the artist is monitoring for airplay detection.
/// Each row shows song info, status, play stats, and trend.
/// Tapping navigates to the detailed SongAnalyticsView.
struct MonitoredSongsView: View {
    @State private var viewModel = MonitoredSongsViewModel()
    @State private var showingAddSheet = false

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.songs.isEmpty {
                LoadingView()
            } else if let errorMessage = viewModel.error, viewModel.songs.isEmpty {
                ErrorView(message: errorMessage) {
                    Task { await viewModel.loadSongs() }
                }
            } else if viewModel.songs.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.songs) { song in
                            NavigationLink {
                                SongAnalyticsView(song: song)
                            } label: {
                                songRow(song)
                            }
                            .buttonStyle(SongRowButtonStyle())
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 40)
                }
                .refreshable {
                    await viewModel.loadSongs()
                }
            }
        }
        .navigationTitle("My Songs")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAddSheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(Color.rbAccent)
                        .font(.title3)
                }
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            AddSongSheet(viewModel: viewModel)
        }
        .task {
            await viewModel.loadSongs()
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "music.note.list")
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(Color.rbAccent.opacity(0.5))

            Text("No Monitored Songs")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.rbTextPrimary)

            Text("Add songs to track their airplay across radio stations.")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button {
                showingAddSheet = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .bold))
                    Text("Add Song")
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(.black)
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .background(Color.rbAccent)
                .clipShape(Capsule())
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Song Row

    private func songRow(_ song: MonitoredSong) -> some View {
        HStack(spacing: 14) {
            // Song thumbnail
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [.rbAccent.opacity(0.2), .rbSurface],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: "music.note")
                        .font(.system(size: 18, weight: .light))
                        .foregroundStyle(Color.rbAccent.opacity(0.7))
                }

            // Song info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(song.songTitle)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.rbTextPrimary)
                        .lineLimit(1)

                    statusBadge(song.status)
                }

                Text(song.isrc)
                    .font(.caption)
                    .foregroundStyle(Color.rbTextTertiary)
                    .lineLimit(1)

                // Stats row
                HStack(spacing: 12) {
                    if let plays = song.totalPlays {
                        HStack(spacing: 3) {
                            Image(systemName: "play.fill")
                                .font(.system(size: 8))
                                .foregroundStyle(Color.rbAccent)
                            Text("\(plays)")
                                .font(.caption)
                                .foregroundStyle(Color.rbTextSecondary)
                        }
                    }

                    if let stations = song.stationCount {
                        HStack(spacing: 3) {
                            Image(systemName: "antenna.radiowaves.left.and.right")
                                .font(.system(size: 8))
                                .foregroundStyle(Color.rbTextTertiary)
                            Text("\(stations) stations")
                                .font(.caption)
                                .foregroundStyle(Color.rbTextSecondary)
                        }
                    }
                }
            }

            Spacer()

            // Trend + chevron
            VStack(alignment: .trailing, spacing: 6) {
                if let trend = song.trend {
                    TrendBadge(
                        direction: trend.direction,
                        percentChange: trend.percentChange,
                        compact: true
                    )
                }

                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(Color.rbTextTertiary)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.5)
        )
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.rbSurface.opacity(0.4))
        )
        .contentShape(Rectangle())
    }

    // MARK: - Status Badge

    private func statusBadge(_ status: String) -> some View {
        let (color, label) = statusInfo(status)
        return Text(label)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                Capsule()
                    .fill(color.opacity(0.15))
            )
    }

    private func statusInfo(_ status: String) -> (Color, String) {
        switch status.lowercased() {
        case "active":
            return (.green, "ACTIVE")
        case "expired":
            return (Color.rbTextTertiary, "EXPIRED")
        case "pending":
            return (.yellow, "PENDING")
        default:
            return (Color.rbTextTertiary, status.uppercased())
        }
    }
}

// MARK: - Button Style

private struct SongRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    NavigationStack {
        MonitoredSongsView()
    }
    .preferredColorScheme(.dark)
}
