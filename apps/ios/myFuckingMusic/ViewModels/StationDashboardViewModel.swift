import Foundation

/// Manages station dashboard state: overview metrics and top songs.
/// Uses async let for concurrent fetching of overview and top songs.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class StationDashboardViewModel {
    // MARK: - Published State

    /// Station overview response containing aggregate metrics.
    var overview: StationOverviewResponse?

    /// Top songs for the station in the selected period.
    var topSongs: [StationTopSong] = []

    /// Selected time period for data.
    var selectedPeriod: String = "week"

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Data Loading

    /// Fetch station overview and top songs in parallel for the selected period.
    func loadOverview() async {
        isLoading = true
        error = nil
        do {
            async let overviewTask: StationOverviewResponse = APIClient.shared.request(
                .stationOverview(period: selectedPeriod)
            )
            async let topTask: [StationTopSong] = APIClient.shared.request(
                .stationTopSongs(period: selectedPeriod, limit: 20)
            )

            let (o, t) = try await (overviewTask, topTask)
            overview = o
            topSongs = t
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
