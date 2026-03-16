import SwiftUI

/// Main detections tab.
/// Shows paginated airplay events with search bar, filter chips, and infinite scroll.
struct DetectionsView: View {
    @State private var viewModel = DetectionsViewModel()
    @Environment(AudioPlayerManager.self) private var audioPlayer

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter chips below search bar
                FilterChipsView(
                    startDate: $viewModel.startDate,
                    endDate: $viewModel.endDate,
                    selectedStationId: $viewModel.selectedStationId,
                    stations: viewModel.stations,
                    onFilterChange: {
                        await viewModel.loadInitial()
                    }
                )

                // Main content
                Group {
                    if viewModel.isLoading && viewModel.detections.isEmpty {
                        LoadingView(message: "Loading detections...")
                    } else if let error = viewModel.error, viewModel.detections.isEmpty {
                        ErrorView(message: error) {
                            Task {
                                await viewModel.loadInitial()
                            }
                        }
                    } else if viewModel.detections.isEmpty && !viewModel.isLoading {
                        emptyState
                    } else {
                        detectionsList
                    }
                }
            }
            .navigationTitle("Detections")
            .searchable(
                text: $viewModel.searchQuery,
                prompt: "Search songs, artists, ISRC..."
            )
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                await viewModel.loadStations()
                await viewModel.loadInitial()
            }
            .task(id: viewModel.searchQuery) {
                // Debounce search: wait 300ms, then reload.
                // SwiftUI .task(id:) auto-cancels previous tasks when searchQuery changes.
                do {
                    try await Task.sleep(for: .milliseconds(300))
                    await viewModel.loadInitial()
                } catch {
                    // Task cancelled -- a new search query was typed
                }
            }
        }
    }

    // MARK: - Detections List

    private var detectionsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(viewModel.detections.enumerated()), id: \.element.id) { index, event in
                    DetectionRowView(event: event)

                    Divider()
                        .padding(.leading)

                    // Trigger load more when approaching the last 5 items
                    if index >= viewModel.detections.count - 5 {
                        Color.clear
                            .frame(height: 0)
                            .onAppear {
                                Task {
                                    await viewModel.loadMore()
                                }
                            }
                    }
                }

                // Loading more indicator
                if viewModel.isLoadingMore {
                    ProgressView()
                        .padding()
                }
            }
            .animation(.easeInOut, value: audioPlayer.currentlyPlayingId)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "music.note.list")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)

            Text("No detections found")
                .font(.headline)
                .foregroundStyle(.secondary)

            if !viewModel.searchQuery.isEmpty {
                Text("Try a different search term")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    DetectionsView()
        .environment(AudioPlayerManager())
}
