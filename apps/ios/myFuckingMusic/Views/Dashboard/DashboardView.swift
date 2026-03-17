import SwiftUI

/// Main dashboard tab view.
/// Shows summary cards, play count chart, and top stations.
/// Segmented control switches between Day/Week/Month periods.
struct DashboardView: View {
    @State private var viewModel = DashboardViewModel()

    var body: some View {
        ZStack {
            // Full-screen dark background
            Color.rbBackground
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.summaryResponse == nil {
                // Initial loading state (no cached data yet)
                LoadingView()
            } else if let errorMessage = viewModel.error, viewModel.summaryResponse == nil {
                // Error state with no cached data
                ErrorView(message: errorMessage) {
                    Task { await viewModel.loadDashboard() }
                }
            } else {
                // Content
                ScrollView {
                    VStack(spacing: 20) {
                        // Period picker
                        Picker("Period", selection: $viewModel.selectedPeriod) {
                            ForEach(TimePeriod.allCases, id: \.self) { period in
                                Text(period.displayLabel).tag(period)
                            }
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal)
                        .colorMultiply(.rbAccent)

                        // Summary cards
                        SummaryCardsView(
                            totals: viewModel.summaryResponse?.totals,
                            onPlaysTapped: {
                                print("Navigate to Detections tab (plays)")
                            },
                            onSongsTapped: {
                                print("Navigate to Detections tab (songs)")
                            },
                            onArtistsTapped: {
                                print("Navigate to Artists tab")
                            }
                        )

                        // Play count trend chart
                        PlayCountChartView(
                            data: viewModel.summaryResponse?.buckets ?? [],
                            period: viewModel.selectedPeriod
                        )

                        // Top stations
                        TopStationsView(stations: viewModel.topStations)
                    }
                }
                .refreshable {
                    await viewModel.loadDashboard()
                }
            }
        }
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task(id: viewModel.selectedPeriod) {
            await viewModel.loadDashboard()
        }
    }
}

#Preview {
    NavigationStack {
        DashboardView()
    }
}
