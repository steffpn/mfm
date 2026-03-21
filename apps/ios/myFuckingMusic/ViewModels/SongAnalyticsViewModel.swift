import Foundation

/// Manages song-level analytics: station breakdown, heatmap, peak hours, and trends.
/// Uses async let for concurrent fetching of all analytics endpoints.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class SongAnalyticsViewModel {
    // MARK: - Published State

    /// Detailed analytics for a specific song.
    var analytics: SongAnalyticsResponse?

    /// Station-by-station breakdown of plays.
    var stationBreakdown: [StationBreakdownItem] = []

    /// Hourly heatmap data showing play distribution.
    var heatmap: HourlyHeatmapResponse?

    /// Peak hours when the song is most played.
    var peakHours: [PeakHourSlot] = []

    /// Trend data showing play count over time.
    var trend: SongTrend?

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Data Loading

    /// Fetch all analytics data for a song in parallel.
    func loadAllAnalytics(songId: Int) async {
        isLoading = true
        error = nil

        async let analyticsTask: SongAnalyticsResponse = APIClient.shared.request(
            .songAnalytics(songId: songId)
        )
        async let breakdownTask: [StationBreakdownItem] = APIClient.shared.request(
            .songStationBreakdown(songId: songId)
        )
        async let heatmapTask: HourlyHeatmapResponse = APIClient.shared.request(
            .songHourlyHeatmap(songId: songId)
        )
        async let peakTask: [PeakHourSlot] = APIClient.shared.request(
            .songPeakHours(songId: songId)
        )
        async let trendTask: SongTrend = APIClient.shared.request(
            .songTrend(songId: songId)
        )

        do {
            let (a, b, h, p, t) = try await (analyticsTask, breakdownTask, heatmapTask, peakTask, trendTask)
            analytics = a
            stationBreakdown = b
            heatmap = h
            peakHours = p
            trend = t
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}
