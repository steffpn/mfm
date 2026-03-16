import Foundation

/// Manages dashboard state: period selection, data fetching, loading/error states.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class DashboardViewModel {
    // MARK: - Published State

    /// Currently selected time period. Views use .task(id:) to react to changes.
    var selectedPeriod: TimePeriod = .day

    /// Dashboard summary response containing buckets and totals.
    var summaryResponse: DashboardSummaryResponse?

    /// Top stations list for the selected period.
    var topStations: [StationPlayCount] = []

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Computed Properties

    /// Whether any dashboard data has been loaded (used to distinguish initial load from refresh).
    var hasData: Bool {
        summaryResponse != nil
    }

    /// Total play count for the current period, or nil if not loaded.
    var totalPlays: Int? {
        summaryResponse?.totals.playCount
    }

    /// Total unique songs for the current period, or nil if not loaded.
    var totalSongs: Int? {
        summaryResponse?.totals.uniqueSongs
    }

    /// Total unique artists for the current period, or nil if not loaded.
    var totalArtists: Int? {
        summaryResponse?.totals.uniqueArtists
    }

    // MARK: - Data Loading

    /// Fetch dashboard summary and top stations in parallel for the selected period.
    /// Uses async let for concurrent requests. Sets isLoading during fetch, clears on completion.
    /// On error, sets error string for display by ErrorView.
    func loadDashboard() async {
        isLoading = true
        error = nil

        do {
            // Fetch both endpoints in parallel
            async let summaryTask: DashboardSummaryResponse = APIClient.shared.request(
                .dashboardSummary(period: selectedPeriod.rawValue)
            )
            async let stationsTask: TopStationsResponse = APIClient.shared.request(
                .topStations(period: selectedPeriod.rawValue, limit: 10)
            )

            let (summary, stations) = try await (summaryTask, stationsTask)

            summaryResponse = summary
            topStations = stations.stations
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}
