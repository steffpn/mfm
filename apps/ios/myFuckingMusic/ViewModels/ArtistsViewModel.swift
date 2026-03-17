import Foundation
import Observation
import UIKit

/// ViewModel managing the Artists tab: loads airplay events, aggregates by artist,
/// fetches artist photos from Deezer, and supports search filtering.
@Observable
@MainActor
final class ArtistsViewModel {

    // MARK: - Data

    var artists: [ArtistSummary] = []
    var allEvents: [AirplayEvent] = []

    /// Events grouped by artist name for detail view usage.
    var eventsByArtist: [String: [AirplayEvent]] = [:]

    // MARK: - Loading State

    var isLoading = false
    var error: String?

    // MARK: - Search

    var searchQuery = ""

    var filteredArtists: [ArtistSummary] {
        if searchQuery.isEmpty {
            return artists
        }
        return artists.filter { $0.name.localizedCaseInsensitiveContains(searchQuery) }
    }

    // MARK: - Artist Images

    var artistImages: [String: UIImage] = [:]

    // MARK: - Pagination

    private var nextCursor: Int?
    private let pageSize = 50

    // MARK: - Public Methods

    /// Load all airplay events and aggregate into artist summaries.
    func loadArtists() async {
        isLoading = true
        error = nil
        allEvents = []
        nextCursor = nil

        do {
            // Fetch multiple pages to get a good artist overview
            var fetchedEvents: [AirplayEvent] = []
            var cursor: Int? = nil

            // Fetch up to 5 pages (250 events) for artist aggregation
            for _ in 0..<5 {
                let response: PaginatedResponse<AirplayEvent> = try await APIClient.shared.request(
                    .airplayEvents(
                        cursor: cursor,
                        limit: pageSize,
                        query: nil,
                        startDate: nil,
                        endDate: nil,
                        stationId: nil
                    )
                )

                fetchedEvents.append(contentsOf: response.data)
                cursor = response.nextCursor

                if response.nextCursor == nil {
                    break
                }
            }

            allEvents = fetchedEvents
            aggregateArtists()
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Pull-to-refresh handler.
    func refresh() async {
        await loadArtists()
    }

    /// Fetch artist photo from Deezer API.
    func loadArtistImage(for artistName: String) async {
        // Skip if already cached
        guard artistImages[artistName] == nil else { return }

        let query = artistName
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString = "https://api.deezer.com/search/artist?q=\(query)&limit=1"

        guard let url = URL(string: urlString) else { return }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let result = try JSONDecoder().decode(DeezerArtistSearchResult.self, from: data)

            if let pictureUrl = result.data?.first?.pictureXl,
               let imageUrl = URL(string: pictureUrl) {
                let (imageData, _) = try await URLSession.shared.data(from: imageUrl)
                if let image = UIImage(data: imageData) {
                    artistImages[artistName] = image
                }
            }
        } catch {
            // Silent fail - placeholder stays
        }
    }

    /// Get events for a specific artist.
    func events(for artistName: String) -> [AirplayEvent] {
        return eventsByArtist[artistName] ?? []
    }

    // MARK: - Private

    /// Aggregate airplay events into artist summaries sorted by play count.
    private func aggregateArtists() {
        var summaries: [String: ArtistSummary] = [:]
        var grouped: [String: [AirplayEvent]] = [:]

        for event in allEvents {
            let name = event.artistName

            // Group events by artist
            grouped[name, default: []].append(event)

            if var existing = summaries[name] {
                existing.playCount += event.playCount
                existing.songCount = Set(grouped[name]!.map { $0.songTitle }).count
                if event.startedAt > existing.lastDetectedAt {
                    existing.lastDetectedAt = event.startedAt
                }
                if let station = event.station?.name {
                    existing.stationNames.insert(station)
                }
                // Update top song: the one with highest play count
                let songCounts = Dictionary(
                    grouped[name]!.map { ($0.songTitle, $0.playCount) },
                    uniquingKeysWith: +
                )
                existing.topSong = songCounts.max(by: { $0.value < $1.value })?.key
                summaries[name] = existing
            } else {
                var stationNames: Set<String> = []
                if let station = event.station?.name {
                    stationNames.insert(station)
                }
                summaries[name] = ArtistSummary(
                    id: name,
                    name: name,
                    playCount: event.playCount,
                    songCount: 1,
                    lastDetectedAt: event.startedAt,
                    topSong: event.songTitle,
                    stationNames: stationNames
                )
            }
        }

        eventsByArtist = grouped
        artists = summaries.values.sorted { $0.playCount > $1.playCount }
    }
}

// MARK: - Deezer Artist Search Models

private struct DeezerArtistSearchResult: Codable {
    let data: [DeezerArtist]?
}

private struct DeezerArtist: Codable {
    let name: String?
    let pictureXl: String?

    enum CodingKeys: String, CodingKey {
        case name
        case pictureXl = "picture_xl"
    }
}
