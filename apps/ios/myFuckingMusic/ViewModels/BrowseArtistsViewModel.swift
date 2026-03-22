import Foundation

@MainActor @Observable
final class BrowseArtistsViewModel {
    var searchQuery = ""
    var artists: [DeezerArtistResult] = []
    var tracks: [DeezerTrackResult] = []
    var selectedArtist: DeezerArtistResult?
    var isSearching = false
    var isLoadingTracks = false
    var error: String?

    private var searchTask: Task<Void, Never>?

    func search() {
        searchTask?.cancel()

        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 2 else {
            artists = []
            return
        }

        searchTask = Task {
            isSearching = true
            defer { isSearching = false }

            do {
                try await Task.sleep(for: .milliseconds(300)) // debounce
                if Task.isCancelled { return }
                artists = try await APIClient.shared.request(.browseArtists(query: query))
            } catch {
                if !Task.isCancelled {
                    self.error = error.localizedDescription
                }
            }
        }
    }

    func loadTracks(for artist: DeezerArtistResult) async {
        selectedArtist = artist
        isLoadingTracks = true
        error = nil
        do {
            tracks = try await APIClient.shared.request(.browseArtistTracks(deezerId: artist.deezerId))
        } catch {
            self.error = error.localizedDescription
        }
        isLoadingTracks = false
    }
}
