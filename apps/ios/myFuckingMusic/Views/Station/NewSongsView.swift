import SwiftUI

/// New songs appearing on a station for the first time.
/// Shows green "NEW" badges and first-played timestamps.
struct NewSongsView: View {
    @State private var viewModel = StationAnalyticsViewModel()

    /// The station ID to load new songs for.
    /// When nil, loads for the user's own station (stationId 0 as sentinel).
    let stationId: Int

    init(stationId: Int = 0) {
        self.stationId = stationId
    }

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.newSongs.isEmpty {
                LoadingView()
            } else if let errorMessage = viewModel.error, viewModel.newSongs.isEmpty {
                ErrorView(message: errorMessage) {
                    Task { await viewModel.loadNewSongs(stationId: stationId) }
                }
            } else if viewModel.newSongs.isEmpty {
                emptyStateView
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        // Period picker
                        Picker("Period", selection: $viewModel.selectedPeriod) {
                            Text("Today").tag("day")
                            Text("This Week").tag("week")
                            Text("This Month").tag("month")
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .colorMultiply(.rbAccent)

                        LazyVStack(spacing: 0) {
                            ForEach(viewModel.newSongs) { song in
                                newSongRow(song)

                                Divider()
                                    .overlay(Color.rbSurfaceLight.opacity(0.5))
                                    .padding(.leading, 16)
                            }
                        }
                    }
                    .padding(.bottom, 40)
                }
                .refreshable {
                    await viewModel.loadNewSongs(stationId: stationId)
                }
            }
        }
        .navigationTitle("New Songs")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task(id: viewModel.selectedPeriod) {
            await viewModel.loadNewSongs(stationId: stationId)
        }
    }

    // MARK: - New Song Row

    private func newSongRow(_ song: NewSongItem) -> some View {
        HStack(spacing: 14) {
            // Song icon with NEW badge overlay
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.rbSurface)
                    .frame(width: 44, height: 44)
                    .overlay {
                        Image(systemName: "music.note")
                            .font(.system(size: 18))
                            .foregroundStyle(Color.rbAccent)
                    }

                // NEW badge
                Text("NEW")
                    .font(.system(size: 7, weight: .black))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(.green)
                    )
                    .offset(x: 4, y: -4)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(song.songTitle)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.rbTextPrimary)
                    .lineLimit(1)

                Text(song.artistName)
                    .font(.caption)
                    .foregroundStyle(Color.rbTextSecondary)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.rbTextTertiary)

                    Text(formatFirstPlayed(song.firstPlayedAt))
                        .font(.caption2)
                        .foregroundStyle(Color.rbTextTertiary)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundStyle(Color.rbTextTertiary)

            Text("No New Songs")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.rbTextPrimary)

            Text("New songs detected for the first time will appear here")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    private func formatFirstPlayed(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        NewSongsView(stationId: 1)
    }
    .preferredColorScheme(.dark)
}
