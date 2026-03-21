import Foundation

/// Manages the label's artist roster: loading, adding, and removing artists.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class LabelArtistListViewModel {
    // MARK: - Published State

    /// List of artists under the label.
    var artists: [LabelArtistSummary] = []

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Data Loading

    /// Fetch the list of label artists.
    func loadArtists() async {
        isLoading = true
        error = nil
        do {
            artists = try await APIClient.shared.request(.labelArtists)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Mutations

    /// Add an artist to the label roster. Returns true on success.
    func addArtist(name: String) async -> Bool {
        do {
            let _: LabelArtistSummary = try await APIClient.shared.request(
                .addLabelArtist(artistName: name)
            )
            await loadArtists()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Remove an artist from the label roster.
    func removeArtist(id: Int) async {
        do {
            let _: EmptyResponse = try await APIClient.shared.request(.removeLabelArtist(id: id))
            artists.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
