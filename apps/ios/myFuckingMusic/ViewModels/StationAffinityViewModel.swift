import Foundation

/// Manages station affinity data for labels: which stations play their artists most.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class StationAffinityViewModel {
    // MARK: - Published State

    /// Station affinity items showing play frequency per station.
    var affinityData: [StationAffinityItem] = []

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Data Loading

    /// Fetch station affinity data for the label's artists.
    func loadAffinity() async {
        isLoading = true
        error = nil
        do {
            affinityData = try await APIClient.shared.request(.labelStationAffinity)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
