import Foundation

/// Manages the artist's monitored songs list: loading, adding new songs.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class MonitoredSongsViewModel {
    // MARK: - Published State

    /// List of songs the artist is monitoring.
    var songs: [MonitoredSong] = []

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Data Loading

    /// Fetch the list of monitored songs.
    func loadSongs() async {
        isLoading = true
        error = nil
        do {
            songs = try await APIClient.shared.request(.artistSongs)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Mutations

    /// Add a new song to the monitored list. Returns true on success.
    func addSong(title: String, artist: String, isrc: String) async -> Bool {
        do {
            let _: MonitoredSong = try await APIClient.shared.request(
                .addArtistSong(songTitle: title, artistName: artist, isrc: isrc)
            )
            await loadSongs()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}
