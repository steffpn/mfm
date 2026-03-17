import Foundation

/// Aggregated artist data computed from airplay events
struct ArtistSummary: Identifiable, Sendable {
    let id: String  // artistName as ID
    let name: String
    var playCount: Int
    var songCount: Int
    var lastDetectedAt: Date
    var topSong: String?
    var stationNames: Set<String>
}
