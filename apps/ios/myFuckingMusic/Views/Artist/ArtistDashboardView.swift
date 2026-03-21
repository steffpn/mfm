import SwiftUI

/// Main dashboard for artist role users.
/// Shows today/weekly play counts, most played song, and weekly digest.
struct ArtistDashboardView: View {
    @State private var viewModel = ArtistDashboardViewModel()

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.dashboard == nil {
                LoadingView()
            } else if let errorMessage = viewModel.error, viewModel.dashboard == nil {
                ErrorView(message: errorMessage) {
                    Task { await viewModel.loadDashboard() }
                }
            } else {
                ScrollView {
                    VStack(spacing: 20) {
                        // Summary cards
                        if let dash = viewModel.dashboard {
                            summarySection(dash)
                        }

                        // Most played song
                        if let song = viewModel.dashboard?.mostPlayedSong {
                            mostPlayedCard(song)
                        }

                        // Weekly digest
                        if let digest = viewModel.weeklyDigest, !digest.songs.isEmpty {
                            weeklyDigestSection(digest)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 40)
                }
                .refreshable {
                    await viewModel.loadDashboard()
                    await viewModel.loadWeeklyDigest()
                }
            }
        }
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task {
            await viewModel.loadDashboard()
            await viewModel.loadWeeklyDigest()
        }
    }

    // MARK: - Summary Section

    @ViewBuilder
    private func summarySection(_ dash: ArtistDashboardResponse) -> some View {
        HStack(spacing: 12) {
            statCard(
                title: "Plays Today",
                value: "\(dash.totalPlaysToday)",
                icon: "play.circle.fill",
                color: .rbAccent
            )

            statCard(
                title: "Plays This Week",
                value: "\(dash.totalPlaysWeek)",
                icon: "calendar",
                color: .rbWarm
            )
        }
    }

    private func statCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            Text(value)
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(Color.rbTextPrimary)

            Text(title)
                .font(.caption)
                .foregroundStyle(Color.rbTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.6)
        )
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.rbSurface.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.rbSurfaceLight, lineWidth: 1)
        )
    }

    // MARK: - Most Played Card

    @ViewBuilder
    private func mostPlayedCard(_ song: MostPlayedSongInfo) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "crown.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.rbWarm)

                Text("Most Played")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.rbTextSecondary)
            }

            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [.rbAccent.opacity(0.3), .rbSurface],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 52, height: 52)
                    .overlay {
                        Image(systemName: "music.note")
                            .font(.system(size: 20, weight: .light))
                            .foregroundStyle(Color.rbAccent)
                    }

                VStack(alignment: .leading, spacing: 3) {
                    Text(song.songTitle)
                        .font(.headline)
                        .foregroundStyle(Color.rbTextPrimary)
                        .lineLimit(1)

                    Text(song.artistName)
                        .font(.subheadline)
                        .foregroundStyle(Color.rbTextSecondary)
                        .lineLimit(1)
                }

                Spacer()

                VStack(spacing: 2) {
                    Text("\(song.plays)")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Color.rbAccent)

                    Text("plays")
                        .font(.caption2)
                        .foregroundStyle(Color.rbTextTertiary)
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

    // MARK: - Weekly Digest Section

    @ViewBuilder
    private func weeklyDigestSection(_ digest: WeeklyDigestResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.rbAccent)

                Text("Weekly Report")
                    .font(.headline)
                    .foregroundStyle(Color.rbTextPrimary)

                Spacer()

                Text("\(digest.songs.count) songs")
                    .font(.caption)
                    .foregroundStyle(Color.rbTextTertiary)
            }

            ForEach(digest.songs) { item in
                digestRow(item)
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

    private func digestRow(_ item: SongDigestItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.songTitle)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.rbTextPrimary)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        Text("\(item.playsThisWeek) plays")
                            .font(.caption)
                            .foregroundStyle(Color.rbTextSecondary)

                        TrendBadge(
                            direction: item.direction,
                            percentChange: item.percentChange,
                            compact: true
                        )
                    }
                }

                Spacer()

                Text("\(item.playsThisWeek)")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Color.rbAccent)
            }

            if !item.newStations.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "antenna.radiowaves.left.and.right")
                        .font(.system(size: 9))
                        .foregroundStyle(Color.rbWarm)

                    Text("New on: \(item.newStations.joined(separator: ", "))")
                        .font(.caption2)
                        .foregroundStyle(Color.rbWarm)
                        .lineLimit(1)
                }
            }

            Divider()
                .overlay(Color.rbSurfaceLight.opacity(0.3))
        }
    }
}

#Preview {
    NavigationStack {
        ArtistDashboardView()
    }
    .preferredColorScheme(.dark)
}
