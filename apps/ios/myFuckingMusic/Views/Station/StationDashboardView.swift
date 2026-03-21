import SwiftUI

/// Main dashboard for station role users.
/// Shows summary cards, period picker, and top songs ranking.
struct StationDashboardView: View {
    @State private var viewModel = StationDashboardViewModel()

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.overview == nil {
                LoadingView()
            } else if let errorMessage = viewModel.error, viewModel.overview == nil {
                ErrorView(message: errorMessage) {
                    Task { await viewModel.loadOverview() }
                }
            } else {
                ScrollView {
                    VStack(spacing: 20) {
                        // Period picker
                        Picker("Period", selection: $viewModel.selectedPeriod) {
                            Text("Today").tag("day")
                            Text("This Week").tag("week")
                            Text("This Month").tag("month")
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 16)
                        .colorMultiply(.rbAccent)

                        // Summary cards
                        if let overview = viewModel.overview {
                            summaryCards(overview)
                        }

                        // Top songs ranking
                        if !viewModel.topSongs.isEmpty {
                            topSongsSection
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 40)
                }
                .refreshable {
                    await viewModel.loadOverview()
                }
            }
        }
        .navigationTitle("My Station")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task(id: viewModel.selectedPeriod) {
            await viewModel.loadOverview()
        }
    }

    // MARK: - Summary Cards

    @ViewBuilder
    private func summaryCards(_ overview: StationOverviewResponse) -> some View {
        HStack(spacing: 12) {
            stationStatCard(
                title: "Total Plays",
                value: "\(overview.totalPlays)",
                icon: "play.circle.fill",
                color: .rbAccent
            )

            stationStatCard(
                title: "Unique Songs",
                value: "\(overview.uniqueSongs)",
                icon: "music.note",
                color: .purple
            )

            stationStatCard(
                title: "Artists",
                value: "\(overview.uniqueArtists)",
                icon: "person.2.fill",
                color: .rbWarm
            )
        }
        .padding(.horizontal, 16)
    }

    private func stationStatCard(title: String, value: String, icon: String, color: Color) -> some View {
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
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.6)
        )
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.rbSurface.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.rbSurfaceLight, lineWidth: 1)
        )
    }

    // MARK: - Top Songs

    private var topSongsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.rbAccent)

                Text("Top Songs")
                    .font(.headline)
                    .foregroundStyle(Color.rbTextPrimary)

                Spacer()

                Text("\(viewModel.topSongs.count) songs")
                    .font(.caption)
                    .foregroundStyle(Color.rbTextTertiary)
            }

            LazyVStack(spacing: 0) {
                ForEach(viewModel.topSongs) { song in
                    topSongRow(song)

                    if song.rank < viewModel.topSongs.count {
                        Divider()
                            .overlay(Color.rbSurfaceLight.opacity(0.5))
                            .padding(.leading, 44)
                    }
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
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.rbSurfaceLight, lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    private func topSongRow(_ song: StationTopSong) -> some View {
        HStack(spacing: 12) {
            // Rank badge
            Text("\(song.rank)")
                .font(.headline.weight(.bold))
                .foregroundStyle(song.rank <= 3 ? Color.rbWarm : Color.rbTextTertiary)
                .frame(width: 28, alignment: .center)

            VStack(alignment: .leading, spacing: 3) {
                Text(song.songTitle)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.rbTextPrimary)
                    .lineLimit(1)

                Text(song.artistName)
                    .font(.caption)
                    .foregroundStyle(Color.rbTextSecondary)
                    .lineLimit(1)
            }

            Spacer()

            Text("\(song.playCount)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color.rbAccent)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(Color.rbAccent.opacity(0.12))
                )
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    NavigationStack {
        StationDashboardView()
    }
    .preferredColorScheme(.dark)
}
