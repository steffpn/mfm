import SwiftUI

/// Compact row displaying a single airplay detection.
/// Shows album artwork thumbnail, song title, artist, station name, and timestamp.
/// Tapping navigates to SongDetailView.
struct DetectionRowView: View {
    let event: AirplayEvent
    @State private var artworkImage: UIImage?

    var body: some View {
        NavigationLink {
            SongDetailView(event: event)
        } label: {
            HStack(spacing: 12) {
                // Album artwork thumbnail
                artworkThumbnail

                // Song info
                VStack(alignment: .leading, spacing: 3) {
                    Text(event.songTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.rbTextPrimary)
                        .lineLimit(1)

                    Text(event.artistName)
                        .font(.caption)
                        .foregroundStyle(Color.rbTextSecondary)
                        .lineLimit(1)

                    if let stationName = event.station?.name {
                        Text(stationName)
                            .font(.caption2)
                            .foregroundStyle(Color.rbTextTertiary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Timestamp
                Text(DateFormatters.shortDateTime(event.startedAt))
                    .font(.caption2)
                    .foregroundStyle(Color.rbTextTertiary)

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(Color.rbTextTertiary)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(DetectionRowButtonStyle())
        .task {
            await loadArtwork()
        }
    }

    // MARK: - Artwork Thumbnail

    private var artworkThumbnail: some View {
        Group {
            if let image = artworkImage {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                ZStack {
                    Color.rbSurface
                    Image(systemName: "music.note")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.rbTextTertiary)
                }
            }
        }
        .frame(width: 48, height: 48)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Load Artwork

    private func loadArtwork() async {
        let query = "artist:\"\(event.artistName)\" track:\"\(event.songTitle)\""
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString = "https://api.deezer.com/search?q=\(query)&limit=1"

        guard let url = URL(string: urlString) else { return }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let result = try JSONDecoder().decode(DeezerSearchResult.self, from: data)

            if let coverUrl = result.data?.first?.album?.cover_medium,
               let imageUrl = URL(string: coverUrl) {
                let (imageData, _) = try await URLSession.shared.data(from: imageUrl)
                if let image = UIImage(data: imageData) {
                    await MainActor.run {
                        self.artworkImage = image
                    }
                }
            }
        } catch {
            // Silent fail - placeholder stays
        }
    }
}

// MARK: - Deezer Search Models (lightweight, just for thumbnail)

private struct DeezerSearchResult: Codable {
    let data: [DeezerSearchTrack]?
}

private struct DeezerSearchTrack: Codable {
    let album: DeezerSearchAlbum?
}

private struct DeezerSearchAlbum: Codable {
    let cover_medium: String?
}

// MARK: - Button Style with press feedback

struct DetectionRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color.rbSurfaceHighlight : Color.clear)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}
