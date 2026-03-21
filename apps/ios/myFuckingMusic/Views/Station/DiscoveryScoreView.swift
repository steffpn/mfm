import SwiftUI

/// Discovery score visualization showing how much new music a station plays.
/// Large circular score display (0-100) with supporting stats.
struct DiscoveryScoreView: View {
    @State private var viewModel = StationAnalyticsViewModel()
    @State private var animatedScore: Double = 0

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.discoveryScore == nil {
                LoadingView()
            } else if let errorMessage = viewModel.error, viewModel.discoveryScore == nil {
                ErrorView(message: errorMessage) {
                    Task { await viewModel.loadDiscoveryScore() }
                }
            } else {
                ScrollView {
                    VStack(spacing: 24) {
                        // Period picker
                        Picker("Period", selection: $viewModel.selectedPeriod) {
                            Text("Today").tag("day")
                            Text("This Week").tag("week")
                            Text("This Month").tag("month")
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 16)
                        .colorMultiply(.rbAccent)

                        if let discovery = viewModel.discoveryScore {
                            // Large circular score
                            scoreCircle(discovery)

                            // Stats cards
                            statsSection(discovery)

                            // Descriptive text
                            descriptionCard(discovery)
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 40)
                }
                .refreshable {
                    await viewModel.loadDiscoveryScore()
                }
            }
        }
        .navigationTitle("Discovery Score")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task(id: viewModel.selectedPeriod) {
            await viewModel.loadDiscoveryScore()
        }
        .onChange(of: viewModel.discoveryScore?.score) { _, newValue in
            if let score = newValue {
                withAnimation(.easeOut(duration: 1.0)) {
                    animatedScore = score
                }
            }
        }
    }

    // MARK: - Score Circle

    @ViewBuilder
    private func scoreCircle(_ discovery: DiscoveryScoreResponse) -> some View {
        VStack(spacing: 16) {
            ZStack {
                // Background ring
                Circle()
                    .stroke(Color.rbSurface, lineWidth: 12)

                // Score ring
                Circle()
                    .trim(from: 0, to: CGFloat(min(animatedScore, 100.0) / 100.0))
                    .stroke(
                        AngularGradient(
                            colors: [.rbAccent, .rbWarm, .rbAccent],
                            center: .center,
                            startAngle: .degrees(-90),
                            endAngle: .degrees(270)
                        ),
                        style: StrokeStyle(lineWidth: 12, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))

                // Score number
                VStack(spacing: 4) {
                    Text("\(Int(animatedScore))")
                        .font(.system(size: 56, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.rbTextPrimary)

                    Text("out of 100")
                        .font(.caption)
                        .foregroundStyle(Color.rbTextTertiary)
                }
            }
            .frame(width: 200, height: 200)

            // Score label
            Text(scoreLabel(discovery.score))
                .font(.title3.weight(.semibold))
                .foregroundStyle(scoreColor(discovery.score))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.6)
        )
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.rbSurface.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.rbSurfaceLight, lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Stats Section

    @ViewBuilder
    private func statsSection(_ discovery: DiscoveryScoreResponse) -> some View {
        HStack(spacing: 12) {
            discoveryStat(
                title: "New Songs",
                value: "\(discovery.newSongsCount)",
                icon: "sparkles",
                color: .rbAccent
            )

            discoveryStat(
                title: "Total Songs",
                value: "\(discovery.totalSongsCount)",
                icon: "music.note.list",
                color: .purple
            )

            discoveryStat(
                title: "New %",
                value: discovery.totalSongsCount > 0
                    ? String(format: "%.0f%%", Double(discovery.newSongsCount) / Double(discovery.totalSongsCount) * 100)
                    : "0%",
                icon: "percent",
                color: .rbWarm
            )
        }
        .padding(.horizontal, 16)
    }

    private func discoveryStat(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            Text(value)
                .font(.title2.weight(.bold))
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

    // MARK: - Description Card

    @ViewBuilder
    private func descriptionCard(_ discovery: DiscoveryScoreResponse) -> some View {
        let newPercent = discovery.totalSongsCount > 0
            ? Double(discovery.newSongsCount) / Double(discovery.totalSongsCount) * 100
            : 0
        let catalogPercent = 100 - newPercent

        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.rbAccent)

                Text("What This Means")
                    .font(.headline)
                    .foregroundStyle(Color.rbTextPrimary)
            }

            Text("You play \(String(format: "%.0f%%", newPercent)) new music vs \(String(format: "%.0f%%", catalogPercent)) catalog tracks. A higher discovery score means your station introduces more fresh music to listeners.")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
                .lineSpacing(4)

            if discovery.newSongsPlays > 0 {
                HStack(spacing: 8) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.rbAccent)

                    Text("New songs account for \(discovery.newSongsPlays) of \(discovery.totalPlays) total plays")
                        .font(.caption)
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
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.rbSurfaceLight, lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Helpers

    private func scoreLabel(_ score: Double) -> String {
        switch score {
        case 80...: return "Trailblazer"
        case 60..<80: return "Explorer"
        case 40..<60: return "Balanced"
        case 20..<40: return "Traditional"
        default: return "Conservative"
        }
    }

    private func scoreColor(_ score: Double) -> Color {
        switch score {
        case 60...: return .rbAccent
        case 40..<60: return .rbWarm
        default: return Color.rbTextSecondary
        }
    }
}

#Preview {
    NavigationStack {
        DiscoveryScoreView()
    }
    .preferredColorScheme(.dark)
}
