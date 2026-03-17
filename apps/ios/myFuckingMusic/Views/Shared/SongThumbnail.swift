import SwiftUI

/// Reusable album artwork thumbnail that fetches from Deezer API.
/// Shows a placeholder music note icon while loading.
struct SongThumbnail: View {
    let artist: String
    let title: String
    var size: CGFloat = 44
    var cornerRadius: CGFloat = 8

    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                ZStack {
                    Color.rbSurface
                    Image(systemName: "music.note")
                        .font(.system(size: size * 0.35))
                        .foregroundStyle(Color.rbTextTertiary)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .task {
            await loadImage()
        }
    }

    private func loadImage() async {
        let query = "artist:\"\(artist)\" track:\"\(title)\""
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        guard let url = URL(string: "https://api.deezer.com/search?q=\(query)&limit=1") else { return }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let result = try JSONDecoder().decode(DeezerThumbnailResult.self, from: data)

            if let coverUrl = result.data?.first?.album?.cover_medium,
               let imageUrl = URL(string: coverUrl) {
                let (imageData, _) = try await URLSession.shared.data(from: imageUrl)
                if let uiImage = UIImage(data: imageData) {
                    await MainActor.run { self.image = uiImage }
                }
            }
        } catch {}
    }
}

// MARK: - Deezer API models (private)

private struct DeezerThumbnailResult: Codable {
    let data: [DeezerThumbnailTrack]?
}

private struct DeezerThumbnailTrack: Codable {
    let album: DeezerThumbnailAlbum?
}

private struct DeezerThumbnailAlbum: Codable {
    let cover_medium: String?
}
