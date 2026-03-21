import Foundation

/// Manages artist dashboard state: overview metrics and weekly digest.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class ArtistDashboardViewModel {
    // MARK: - Published State

    /// Artist dashboard response containing overview metrics.
    var dashboard: ArtistDashboardResponse?

    /// Weekly digest response with song performance summaries.
    var weeklyDigest: WeeklyDigestResponse?

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Data Loading

    /// Fetch the artist dashboard overview.
    func loadDashboard() async {
        isLoading = true
        error = nil
        do {
            dashboard = try await APIClient.shared.request(.artistDashboard)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    /// Fetch the weekly digest. Non-critical, does not set error on failure.
    func loadWeeklyDigest() async {
        do {
            weeklyDigest = try await APIClient.shared.request(.artistWeeklyDigest)
        } catch {
            // Non-critical -- dashboard remains functional
        }
    }
}
