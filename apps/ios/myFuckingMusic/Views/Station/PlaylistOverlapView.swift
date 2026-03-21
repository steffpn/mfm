import SwiftUI

/// Playlist overlap analysis with competitor stations.
/// Shows overlap percentage as circular progress and shared songs on expand.
struct PlaylistOverlapView: View {
    @State private var viewModel = StationAnalyticsViewModel()
    @State private var competitorViewModel = CompetitorListViewModel()
    @State private var expandedStationId: Int?

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            if competitorViewModel.isLoading && competitorViewModel.cards.isEmpty {
                LoadingView()
            } else if competitorViewModel.cards.isEmpty {
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

                        LazyVStack(spacing: 12) {
                            ForEach(competitorViewModel.cards) { card in
                                competitorOverlapCard(card)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 40)
                    }
                }
                .refreshable {
                    await competitorViewModel.loadSummary()
                }
            }
        }
        .navigationTitle("Playlist Overlap")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task {
            await competitorViewModel.loadSummary()
        }
    }

    // MARK: - Competitor Overlap Card

    @ViewBuilder
    private func competitorOverlapCard(_ card: CompetitorCard) -> some View {
        let isExpanded = expandedStationId == card.stationId

        VStack(spacing: 0) {
            // Header row
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    if isExpanded {
                        expandedStationId = nil
                    } else {
                        expandedStationId = card.stationId
                        Task { await viewModel.loadPlaylistOverlap(competitorId: card.stationId) }
                    }
                }
            } label: {
                HStack(spacing: 14) {
                    // Circular overlap indicator
                    overlapCircle(
                        percent: viewModel.overlap != nil && isExpanded
                            ? viewModel.overlap!.overlapPercent
                            : 0
                    )

                    VStack(alignment: .leading, spacing: 4) {
                        Text(card.stationName)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.rbTextPrimary)

                        if isExpanded, let overlap = viewModel.overlap {
                            Text("\(overlap.sharedCount) shared songs")
                                .font(.caption)
                                .foregroundStyle(Color.rbTextSecondary)
                        } else {
                            Text("\(card.playCount) plays")
                                .font(.caption)
                                .foregroundStyle(Color.rbTextSecondary)
                        }
                    }

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(Color.rbTextTertiary)
                }
                .padding(14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // Expanded content: shared songs list
            if isExpanded {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(Color.rbAccent)
                        .padding()
                } else if let overlap = viewModel.overlap {
                    Divider()
                        .overlay(Color.rbSurfaceLight.opacity(0.5))

                    // Overlap stats
                    HStack(spacing: 20) {
                        overlapStat(
                            label: "Overlap",
                            value: String(format: "%.0f%%", overlap.overlapPercent)
                        )
                        overlapStat(
                            label: "Only You",
                            value: "\(overlap.exclusiveToYou)"
                        )
                        overlapStat(
                            label: "Only Them",
                            value: "\(overlap.exclusiveToThem)"
                        )
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)

                    if !overlap.sharedSongs.isEmpty {
                        Divider()
                            .overlay(Color.rbSurfaceLight.opacity(0.5))

                        VStack(spacing: 0) {
                            ForEach(overlap.sharedSongs.prefix(10)) { song in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(song.songTitle)
                                            .font(.caption)
                                            .foregroundStyle(Color.rbTextPrimary)
                                            .lineLimit(1)

                                        Text(song.artistName)
                                            .font(.caption2)
                                            .foregroundStyle(Color.rbTextTertiary)
                                            .lineLimit(1)
                                    }

                                    Spacer()

                                    VStack(alignment: .trailing, spacing: 1) {
                                        Text("You: \(song.yourPlays)")
                                            .font(.caption2)
                                            .foregroundStyle(
                                                song.yourPlays >= song.theirPlays
                                                    ? Color.rbAccent
                                                    : Color.rbTextSecondary
                                            )
                                        Text("Them: \(song.theirPlays)")
                                            .font(.caption2)
                                            .foregroundStyle(
                                                song.theirPlays > song.yourPlays
                                                    ? Color.rbWarm
                                                    : Color.rbTextSecondary
                                            )
                                    }
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 6)
                            }
                        }
                    }
                }
            }
        }
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

    // MARK: - Circular Overlap Indicator

    private func overlapCircle(percent: Double) -> some View {
        ZStack {
            Circle()
                .stroke(Color.rbSurface, lineWidth: 4)

            Circle()
                .trim(from: 0, to: CGFloat(min(percent, 100.0) / 100.0))
                .stroke(
                    LinearGradient(
                        colors: [.rbAccent, .rbWarm],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            Text(String(format: "%.0f%%", percent))
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.rbTextPrimary)
        }
        .frame(width: 44, height: 44)
    }

    private func overlapStat(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color.rbTextPrimary)

            Text(label)
                .font(.caption2)
                .foregroundStyle(Color.rbTextTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.system(size: 48))
                .foregroundStyle(Color.rbTextTertiary)

            Text("No Competitors Added")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.rbTextPrimary)

            Text("Add competitor stations in Settings to see playlist overlap analysis")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    NavigationStack {
        PlaylistOverlapView()
    }
    .preferredColorScheme(.dark)
}
