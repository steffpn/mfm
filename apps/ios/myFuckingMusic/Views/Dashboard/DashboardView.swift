import SwiftUI

/// Main dashboard tab view.
/// Shows summary cards, play count chart, and top stations.
/// Segmented control switches between Day/Week/Month periods.
struct DashboardView: View {
    @State private var viewModel = DashboardViewModel()

    var body: some View {
        ZStack {
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

                        // Summary cards
                        SummaryCardsView(totals: viewModel.summaryResponse?.totals)

                        // Play count trend chart
                        PlayCountChartView(
                            data: viewModel.summaryResponse?.buckets ?? [],
                            period: viewModel.selectedPeriod
                        )

                        // Top stations
                        TopStationsView(stations: viewModel.topStations)
                    }
                    .padding(.vertical)
                }
                .refreshable {
                    await viewModel.loadDashboard()
                }
            }
        }
        .navigationTitle("Dashboard")
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
