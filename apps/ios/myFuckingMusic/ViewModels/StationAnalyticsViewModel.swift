import Foundation

/// Manages station analytics: new songs, exclusives, overlap, genre, rotation, discovery.
/// Each analytics section has its own load method for on-demand fetching.
/// Uses @Observable for modern SwiftUI data flow (iOS 17+).
@MainActor
@Observable
final class StationAnalyticsViewModel {
    // MARK: - Published State

    /// New songs detected on the station.
    var newSongs: [NewSongItem] = []

    /// Songs exclusive to this station.
    var exclusiveSongs: [ExclusiveSongItem] = []

    /// Playlist overlap with a competitor station.
    var overlap: PlaylistOverlapResponse?

    /// Genre distribution breakdown.
    var genreDistribution: [GenreDistributionItem] = []

    /// Rotation analysis showing play frequency patterns.
    var rotationAnalysis: RotationAnalysisResponse?

    /// Discovery score measuring how early the station picks up new music.
    var discoveryScore: DiscoveryScoreResponse?

    /// Whether a data fetch is in progress.
    var isLoading = false

    /// Error message to display. Nil when no error.
    var error: String?

    /// Selected time period for analytics data.
    var selectedPeriod = "week"

    // MARK: - Data Loading

    /// Fetch new songs for a station.
    func loadNewSongs(stationId: Int) async {
        isLoading = true
        do {
            newSongs = try await APIClient.shared.request(
                .stationNewSongs(stationId: stationId, period: selectedPeriod)
            )
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    /// Fetch exclusive songs for a station.
    func loadExclusiveSongs(stationId: Int) async {
        isLoading = true
        do {
            exclusiveSongs = try await APIClient.shared.request(
                .stationExclusiveSongs(stationId: stationId, period: selectedPeriod)
            )
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    /// Fetch playlist overlap with a competitor station.
    func loadPlaylistOverlap(competitorId: Int) async {
        isLoading = true
        do {
            overlap = try await APIClient.shared.request(
                .stationPlaylistOverlap(competitorId: competitorId, period: selectedPeriod)
            )
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    /// Fetch genre distribution data.
    func loadGenreDistribution() async {
        do {
            genreDistribution = try await APIClient.shared.request(
                .stationGenreDistribution(period: selectedPeriod)
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Fetch rotation analysis data.
    func loadRotationAnalysis() async {
        do {
            rotationAnalysis = try await APIClient.shared.request(
                .stationRotation(period: selectedPeriod)
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Fetch discovery score data.
    func loadDiscoveryScore() async {
        do {
            discoveryScore = try await APIClient.shared.request(
                .stationDiscoveryScore(period: selectedPeriod)
            )
        } catch {
            self.error = error.localizedDescription
        }
    }
}
