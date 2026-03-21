import Foundation

/// Manages label dashboard state: overview metrics across all label artists.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class LabelDashboardViewModel {
    // MARK: - Published State

    /// Label dashboard response containing aggregate metrics.
    var dashboard: LabelDashboardResponse?

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Data Loading

    /// Fetch the label dashboard overview.
    func loadDashboard() async {
        isLoading = true
        error = nil
        do {
            dashboard = try await APIClient.shared.request(.labelDashboard)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
