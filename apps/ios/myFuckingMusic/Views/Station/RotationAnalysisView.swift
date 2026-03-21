import SwiftUI
import Charts

/// Rotation analysis showing unique songs per hour, average rotation,
/// and over-rotated songs with warning indicators.
struct RotationAnalysisView: View {
    @State private var viewModel = StationAnalyticsViewModel()

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.rotationAnalysis == nil {
                LoadingView()
            } else if let errorMessage = viewModel.error, viewModel.rotationAnalysis == nil {
                ErrorView(message: errorMessage) {
                    Task { await viewModel.loadRotationAnalysis() }
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

                        if let rotation = viewModel.rotationAnalysis {
                            // Average rotation stat
                            averageRotationCard(rotation.averageRotation)

                            // Hourly chart
                            hourlyChart(rotation.uniqueSongsPerHour)

                            // Over-rotated songs
                            if !rotation.overRotatedSongs.isEmpty {
                                overRotatedSection(rotation.overRotatedSongs)
                            }
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 40)
                }
                .refreshable {
                    await viewModel.loadRotationAnalysis()
                }
            }
        }
        .navigationTitle("Rotation Analysis")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task(id: viewModel.selectedPeriod) {
            await viewModel.loadRotationAnalysis()
        }
    }

    // MARK: - Average Rotation Card

    @ViewBuilder
    private func averageRotationCard(_ average: Double) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.title2)
                .foregroundStyle(Color.rbAccent)

            Text(String(format: "%.1f", average))
                .font(.system(size: 40, weight: .bold, design: .rounded))
                .foregroundStyle(Color.rbTextPrimary)

            Text("Avg. Unique Songs / Hour")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
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

    // MARK: - Hourly Chart

    @ViewBuilder
    private func hourlyChart(_ buckets: [HourBucket]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.rbAccent)

                Text("Unique Songs per Hour")
                    .font(.headline)
                    .foregroundStyle(Color.rbTextPrimary)
            }

            Chart(buckets) { bucket in
                BarMark(
                    x: .value("Hour", formatHour(bucket.hour)),
                    y: .value("Songs", bucket.count)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [.rbAccent, .rbAccent.opacity(0.6)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .cornerRadius(3)
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 8)) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.rbSurfaceLight)
                    AxisValueLabel()
                        .foregroundStyle(Color.rbTextTertiary)
                        .font(.caption2)
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.rbSurfaceLight)
                    AxisValueLabel()
                        .foregroundStyle(Color.rbTextTertiary)
                }
            }
            .frame(height: 200)
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

    // MARK: - Over-Rotated Songs

    @ViewBuilder
    private func overRotatedSection(_ songs: [OverRotatedSong]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.rbWarm)

                Text("Over-Rotated Songs")
                    .font(.headline)
                    .foregroundStyle(Color.rbTextPrimary)

                Spacer()

                Text("\(songs.count) songs")
                    .font(.caption)
                    .foregroundStyle(Color.rbTextTertiary)
            }

            LazyVStack(spacing: 0) {
                ForEach(songs) { song in
                    HStack(spacing: 12) {
                        // Warning indicator
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(Color.rbWarm)

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

                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(song.playCount) plays")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Color.rbWarm)

                            Text("max \(song.expectedMax)")
                                .font(.caption2)
                                .foregroundStyle(Color.rbTextTertiary)
                        }
                    }
                    .padding(.vertical, 8)

                    if song.id != songs.last?.id {
                        Divider()
                            .overlay(Color.rbSurfaceLight.opacity(0.5))
                            .padding(.leading, 30)
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
                .strokeBorder(Color.rbWarm.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Helpers

    private func formatHour(_ hour: Int) -> String {
        let h = hour % 24
        if h == 0 { return "12a" }
        if h < 12 { return "\(h)a" }
        if h == 12 { return "12p" }
        return "\(h - 12)p"
    }
}

#Preview {
    NavigationStack {
        RotationAnalysisView()
    }
    .preferredColorScheme(.dark)
}
