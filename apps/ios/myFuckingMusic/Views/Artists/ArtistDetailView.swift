import SwiftUI

/// Detail view for a single artist showing photo, stats, and detected songs.
struct ArtistDetailView: View {
    let artist: ArtistSummary
    let viewModel: ArtistsViewModel
    @State private var dominantColors: [Color] = [.rbSurface, .rbBackground, .rbSurfaceLight]
    @State private var appearAnimation = false

    var body: some View {
        ZStack {
            backgroundGradient
                .ignoresSafeArea()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    Spacer()
                        .frame(height: 20)

                    // Artist photo
                    artistPhotoSection
                        .padding(.bottom, 20)

                    // Artist name
                    artistNameSection
                        .padding(.bottom, 24)

                    // Stats row
                    statsRow
                        .padding(.horizontal, 24)
                        .padding(.bottom, 28)

                    // Detected Songs section
                    detectedSongsSection
                        .padding(.horizontal, 24)
                        .padding(.bottom, 40)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task {
            await viewModel.loadArtistImage(for: artist.name)
            extractColors()
            withAnimation(.easeOut(duration: 0.6)) {
                appearAnimation = true
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Background Gradient

    private var backgroundGradient: some View {
        LinearGradient(
            stops: [
                .init(color: dominantColors[0].opacity(0.7), location: 0.0),
                .init(color: dominantColors[safe: 1]?.opacity(0.4) ?? .rbSurface.opacity(0.4), location: 0.3),
                .init(color: dominantColors[safe: 2]?.opacity(0.2) ?? .rbBackground.opacity(0.2), location: 0.55),
                .init(color: .rbBackground, location: 0.85),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .animation(.easeInOut(duration: 0.8), value: dominantColors.count)
    }

    // MARK: - Artist Photo

    private var artistPhotoSection: some View {
        Group {
            if let image = viewModel.artistImages[artist.name] {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 120, height: 120)
                    .clipShape(Circle())
                    .shadow(color: dominantColors[0].opacity(0.5), radius: 20, x: 0, y: 10)
                    .shadow(color: .black.opacity(0.4), radius: 15, x: 0, y: 8)
                    .scaleEffect(appearAnimation ? 1.0 : 0.9)
                    .opacity(appearAnimation ? 1.0 : 0.0)
            } else {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.rbSurfaceLight, .rbSurface],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 120, height: 120)
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.system(size: 40, weight: .light))
                            .foregroundStyle(Color.rbAccent.opacity(0.6))
                    }
                    .shadow(color: .black.opacity(0.3), radius: 15, x: 0, y: 8)
            }
        }
    }

    // MARK: - Artist Name

    private var artistNameSection: some View {
        VStack(spacing: 6) {
            Text(artist.name)
                .font(.title)
                .fontWeight(.bold)
                .foregroundStyle(Color.rbTextPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(3)

            if let topSong = artist.topSong {
                HStack(spacing: 4) {
                    Image(systemName: "star.fill")
                        .font(.caption2)
                        .foregroundStyle(Color.rbWarm)
                    Text("Top: \(topSong)")
                        .font(.caption)
                        .foregroundStyle(Color.rbTextSecondary)
                        .lineLimit(1)
                }
            }
        }
        .opacity(appearAnimation ? 1.0 : 0.0)
        .offset(y: appearAnimation ? 0 : 10)
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(value: "\(artist.playCount)", label: "Total Plays", icon: "play.fill")

            Divider()
                .frame(height: 40)
                .overlay(Color.rbSurfaceLight)

            statItem(value: "\(artist.songCount)", label: "Unique Songs", icon: "music.note")

            Divider()
                .frame(height: 40)
                .overlay(Color.rbSurfaceLight)

            statItem(value: "\(artist.stationNames.count)", label: "Stations", icon: "antenna.radiowaves.left.and.right")
        }
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.6)
        )
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.rbSurface.opacity(0.5))
        )
        .opacity(appearAnimation ? 1.0 : 0.0)
        .offset(y: appearAnimation ? 0 : 15)
    }

    private func statItem(value: String, label: String, icon: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Color.rbAccent)

            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(Color.rbTextPrimary)

            Text(label)
                .font(.caption2)
                .foregroundStyle(Color.rbTextTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Detected Songs Section

    private var detectedSongsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Detected Songs")
                .font(.headline)
                .foregroundStyle(Color.rbTextPrimary)
                .padding(.bottom, 4)

            let events = viewModel.events(for: artist.name)

            if events.isEmpty {
                Text("No songs found")
                    .font(.subheadline)
                    .foregroundStyle(Color.rbTextTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                ForEach(events) { event in
                    NavigationLink {
                        SongDetailView(event: event)
                    } label: {
                        artistSongRow(event: event)
                    }
                    .buttonStyle(ArtistSongRowButtonStyle())
                }
            }
        }
        .opacity(appearAnimation ? 1.0 : 0.0)
        .offset(y: appearAnimation ? 0 : 15)
    }

    private func artistSongRow(event: AirplayEvent) -> some View {
        HStack(spacing: 12) {
            // Album artwork thumbnail
            
            SongThumbnail(artist: event.artistName, title: event.songTitle)

            VStack(alignment: .leading, spacing: 3) {
                Text(event.songTitle)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.rbTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let stationName = event.station?.name {
                        Text(stationName)
                            .font(.caption)
                            .foregroundStyle(Color.rbTextSecondary)
                            .lineLimit(1)
                    }

                    Text(DateFormatters.shortDateTime(event.startedAt))
                        .font(.caption2)
                        .foregroundStyle(Color.rbTextTertiary)
                }
            }

            Spacer()

            if event.playCount > 1 {
                Text("\(event.playCount)x")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.rbAccent)
            }

            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(Color.rbTextTertiary)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.4)
        )
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.rbSurface.opacity(0.3))
        )
        .contentShape(Rectangle())
    }

    // MARK: - Helpers

    private func extractColors() {
        if let image = viewModel.artistImages[artist.name] {
            dominantColors = ColorExtractor.extractColors(from: image, count: 3)
        }
    }
}

// MARK: - Safe Array Subscript

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Button Style

private struct ArtistSongRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    NavigationStack {
        ArtistDetailView(
            artist: ArtistSummary(
                id: "The Weeknd",
                name: "The Weeknd",
                playCount: 42,
                songCount: 8,
                lastDetectedAt: Date(),
                topSong: "Blinding Lights",
                stationNames: ["Radio Capital", "Kiss FM"]
            ),
            viewModel: ArtistsViewModel()
        )
    }
    .preferredColorScheme(.dark)
}
