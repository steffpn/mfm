import Foundation

struct DeezerArtistResult: Codable, Identifiable, Sendable {
    let deezerId: Int
    let name: String
    let pictureUrl: String?
    let pictureBigUrl: String?
    let fanCount: Int
    let albumCount: Int

    var id: Int { deezerId }
}

struct DeezerTrackResult: Codable, Identifiable, Sendable {
    let deezerTrackId: Int
    let title: String
    let duration: Int
    let isrc: String?
    let albumTitle: String?
    let albumCoverUrl: String?

    var id: Int { deezerTrackId }

    var formattedDuration: String {
        let min = duration / 60
        let sec = duration % 60
        return String(format: "%d:%02d", min, sec)
    }
}
