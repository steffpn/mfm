import Foundation

/// Manages artist comparison data for labels: side-by-side metrics.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class ArtistComparisonViewModel {
    // MARK: - Published State

    /// Comparison response with metrics for selected artists.
    var comparisonData: ArtistComparisonResponse?

    /// Artist IDs selected for comparison (minimum 2 required).
    var selectedArtistIds: [Int] = []

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Data Loading

    /// Fetch comparison data for the selected artists. Requires at least 2 selected.
    func loadComparison() async {
        guard selectedArtistIds.count >= 2 else { return }
        isLoading = true
        error = nil
        do {
            comparisonData = try await APIClient.shared.request(
                .labelComparison(artistIds: selectedArtistIds)
            )
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
