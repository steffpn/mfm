import SwiftUI
import UIKit

@Observable
final class SongDetailViewModel {
    var artworkImage: UIImage?
    var dominantColors: [Color] = [.rbSurface, .rbBackground, .rbSurfaceLight]
    var isLoading = true
    var deezerTrack: DeezerTrack?

    // MARK: - Deezer API Models

    struct DeezerSearchResponse: Codable {
        let data: [DeezerTrack]?
    }

    struct DeezerTrack: Codable {
        let id: Int
        let title: String
        let preview: String?
        let duration: Int?
        let album: DeezerAlbum?
        let artist: DeezerArtist?
    }

    struct DeezerAlbum: Codable {
        let id: Int
        let title: String
        // swiftlint:disable:next identifier_name
        let cover_xl: String?
        // swiftlint:disable:next identifier_name
        let cover_big: String?
    }

    struct DeezerArtist: Codable {
        let id: Int
        let name: String
        // swiftlint:disable:next identifier_name
        let picture_xl: String?
    }

    // MARK: - Load Artwork

    func loadArtwork(artist: String, title: String) async {
        isLoading = true

        let query = "artist:\"\(artist)\" track:\"\(title)\""
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString = "https://api.deezer.com/search?q=\(query)&limit=1"

        guard let url = URL(string: urlString) else {
            await MainActor.run { isLoading = false }
            return
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let result = try JSONDecoder().decode(DeezerSearchResponse.self, from: data)

            if let track = result.data?.first {
                await MainActor.run { self.deezerTrack = track }

                if let coverUrl = track.album?.cover_xl ?? track.album?.cover_big,
                   let imageUrl = URL(string: coverUrl) {
                    let (imageData, _) = try await URLSession.shared.data(from: imageUrl)
                    if let image = UIImage(data: imageData) {
                        let colors = ColorExtractor.extractColors(from: image, count: 3)
                            .map { ColorExtractor.vibrant($0) }
                        await MainActor.run {
                            self.artworkImage = image
                            self.dominantColors = colors
                            self.isLoading = false
                        }
                        return
                    }
                }
            }
        } catch {
            // Fall through to default state
        }

        await MainActor.run { isLoading = false }
    }
}
