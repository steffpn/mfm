import SwiftUI

struct ArtistPickerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = BrowseArtistsViewModel()
    let onArtistSelected: (String) -> Void  // callback with artist name

    var body: some View {
        NavigationStack {
            ZStack {
                Color.rbBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Search bar
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(Color.rbTextTertiary)

                        TextField("Search artists...", text: $viewModel.searchQuery)
                            .foregroundStyle(Color.rbTextPrimary)
                            .autocorrectionDisabled()
                            .onChange(of: viewModel.searchQuery) { _, _ in
                                viewModel.search()
                            }

                        if !viewModel.searchQuery.isEmpty {
                            Button {
                                viewModel.searchQuery = ""
                                viewModel.artists = []
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(Color.rbTextTertiary)
                            }
                        }
                    }
                    .padding(12)
                    .background(Color.rbSurface, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                    if viewModel.isSearching {
                        Spacer()
                        ProgressView()
                            .tint(Color.rbAccent)
                        Spacer()
                    } else if viewModel.artists.isEmpty && !viewModel.searchQuery.isEmpty {
                        Spacer()
                        VStack(spacing: 8) {
                            Image(systemName: "music.mic")
                                .font(.system(size: 40))
                                .foregroundStyle(Color.rbTextTertiary)
                            Text("No artists found")
                                .font(.subheadline)
                                .foregroundStyle(Color.rbTextSecondary)
                        }
                        Spacer()
                    } else if viewModel.artists.isEmpty {
                        Spacer()
                        VStack(spacing: 8) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 40))
                                .foregroundStyle(Color.rbTextTertiary)
                            Text("Search for an artist to add")
                                .font(.subheadline)
                                .foregroundStyle(Color.rbTextSecondary)
                        }
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(viewModel.artists) { artist in
                                    Button {
                                        onArtistSelected(artist.name)
                                        dismiss()
                                    } label: {
                                        artistRow(artist)
                                    }
                                    .buttonStyle(.plain)

                                    Divider()
                                        .overlay(Color.rbSurfaceLight.opacity(0.5))
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Add Artist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.rbTextSecondary)
                }
            }
        }
    }

    private func artistRow(_ artist: DeezerArtistResult) -> some View {
        HStack(spacing: 14) {
            // Artist photo
            AsyncImage(url: URL(string: artist.pictureUrl ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    artistPlaceholder
                default:
                    artistPlaceholder
                        .overlay(ProgressView().tint(Color.rbAccent))
                }
            }
            .frame(width: 50, height: 50)
            .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(artist.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.rbTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    if artist.fanCount > 0 {
                        Text("\(formatNumber(artist.fanCount)) fans")
                            .font(.caption)
                            .foregroundStyle(Color.rbTextTertiary)
                    }
                    if artist.albumCount > 0 {
                        Text("\(artist.albumCount) albums")
                            .font(.caption)
                            .foregroundStyle(Color.rbTextTertiary)
                    }
                }
            }

            Spacer()

            Image(systemName: "plus.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(Color.rbAccent)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    private var artistPlaceholder: some View {
        Circle()
            .fill(Color.rbSurfaceLight)
            .overlay {
                Image(systemName: "person.fill")
                    .foregroundStyle(Color.rbTextTertiary)
            }
    }

    private func formatNumber(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
        return "\(n)"
    }
}
