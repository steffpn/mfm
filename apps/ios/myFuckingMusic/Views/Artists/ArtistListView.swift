import SwiftUI

/// List of artists aggregated from airplay events.
/// Shows artist photo, name, play count, song count, and last detected time.
struct ArtistListView: View {
    @State private var viewModel = ArtistsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.rbBackground
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.artists.isEmpty {
                    loadingState
                } else if let error = viewModel.error, viewModel.artists.isEmpty {
                    errorState(error)
                } else if viewModel.filteredArtists.isEmpty && !viewModel.searchQuery.isEmpty {
                    emptySearchState
                } else if viewModel.artists.isEmpty {
                    emptyState
                } else {
                    artistList
                }
            }
            .navigationTitle("Artists")
            .toolbarBackground(Color.rbBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .searchable(
                text: $viewModel.searchQuery,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search artists..."
            )
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                if viewModel.artists.isEmpty {
                    await viewModel.loadArtists()
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Artist List

    private var artistList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(viewModel.filteredArtists) { artist in
                    NavigationLink {
                        ArtistDetailView(artist: artist, viewModel: viewModel)
                    } label: {
                        ArtistRowView(artist: artist, viewModel: viewModel)
                    }
                    .buttonStyle(ArtistRowButtonStyle())

                    Divider()
                        .overlay(Color.rbSurfaceLight.opacity(0.5))
                }
            }
        }
    }

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(Color.rbAccent)
                .scaleEffect(1.2)
            Text("Loading artists...")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
        }
    }

    private func errorState(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(Color.rbError)

            Text("Failed to load artists")
                .font(.headline)
                .foregroundStyle(Color.rbTextPrimary)

            Text(error)
                .font(.caption)
                .foregroundStyle(Color.rbTextSecondary)
                .multilineTextAlignment(.center)

            Button("Retry") {
                Task { await viewModel.loadArtists() }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.rbAccent)
        }
        .padding()
    }

    private var emptySearchState: some View {
        VStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 36))
                .foregroundStyle(Color.rbTextTertiary)

            Text("No artists found")
                .font(.headline)
                .foregroundStyle(Color.rbTextPrimary)

            Text("Try a different search term")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 36))
                .foregroundStyle(Color.rbTextTertiary)

            Text("No artists yet")
                .font(.headline)
                .foregroundStyle(Color.rbTextPrimary)

            Text("Artists will appear once airplay events are detected")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - Artist Row View

private struct ArtistRowView: View {
    let artist: ArtistSummary
    let viewModel: ArtistsViewModel

    var body: some View {
        HStack(spacing: 12) {
            // Artist photo (circular, 56x56)
            artistPhoto

            // Artist info
            VStack(alignment: .leading, spacing: 3) {
                Text(artist.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.rbTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    Label("\(artist.playCount)", systemImage: "play.fill")
                        .font(.caption)
                        .foregroundStyle(Color.rbAccent)

                    Label("\(artist.songCount) song\(artist.songCount == 1 ? "" : "s")", systemImage: "music.note")
                        .font(.caption)
                        .foregroundStyle(Color.rbTextSecondary)
                }

                Text(DateFormatters.relativeTime(artist.lastDetectedAt))
                    .font(.caption2)
                    .foregroundStyle(Color.rbTextTertiary)
            }

            Spacer()

            // Chevron
            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(Color.rbTextTertiary)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .task {
            await viewModel.loadArtistImage(for: artist.name)
        }
    }

    private var artistPhoto: some View {
        Group {
            if let image = viewModel.artistImages[artist.name] {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                ZStack {
                    Color.rbSurface
                    Image(systemName: "person.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Color.rbTextTertiary)
                }
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(Circle())
    }
}

// MARK: - Button Style

private struct ArtistRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color.rbSurfaceHighlight : Color.clear)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    ArtistListView()
}
