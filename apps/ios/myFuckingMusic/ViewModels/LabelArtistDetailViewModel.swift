import Foundation

/// Manages a single label artist's songs and monitoring toggles.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class LabelArtistDetailViewModel {
    // MARK: - Published State

    /// Songs for the selected label artist.
    var songs: [LabelArtistSong] = []

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    // MARK: - Configuration

    /// The artist ID this view model manages.
    let artistId: Int

    init(artistId: Int) {
        self.artistId = artistId
    }

    // MARK: - Data Loading

    /// Fetch songs for the label artist.
    func loadSongs() async {
        isLoading = true
        error = nil
        do {
            songs = try await APIClient.shared.request(.labelArtistSongs(artistId: artistId))
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Mutations

    /// Toggle monitoring on/off for a song. Reloads songs list after toggle.
    func toggleMonitoring(song: LabelArtistSong) async {
        do {
            let _: LabelArtistSong = try await APIClient.shared.request(
                .toggleLabelSongMonitoring(
                    artistId: artistId,
                    songTitle: song.songTitle,
                    artistName: song.artistName,
                    isrc: song.isrc,
                    enabled: !song.isMonitored
                )
            )
            await loadSongs()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
