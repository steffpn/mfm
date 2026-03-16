import SwiftUI

/// Live feed tab showing real-time detections via SSE streaming.
/// Features: empty state with pulsing waveform, slide-in animations, "New detections" pill,
/// connection status indicator, and background/foreground lifecycle management.
struct LiveFeedView: View {
    @State private var viewModel = LiveFeedViewModel()
    @Environment(AudioPlayerManager.self) private var audioPlayer
    @Environment(\.scenePhase) private var scenePhase

    /// Tracks which event ID is at the top of the scroll view for "isAtTop" detection.
    @State private var topVisibleId: Int?
    /// Controls the scroll position for programmatic scrolling.
    @State private var scrollTarget: Int?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                content

                // New detections pill overlay
                if viewModel.newEventCount > 0 {
                    NewDetectionsPill(count: viewModel.newEventCount) {
                        scrollToTop()
                    }
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(1)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: viewModel.newEventCount > 0)
            .navigationTitle("Live")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    connectionIndicator
                }
            }
        }
        .task { await connectToFeed() }
        .onChange(of: scenePhase) { _, newPhase in
            handleScenePhaseChange(newPhase)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.events.isEmpty && viewModel.connectionState != .disconnected {
            // Empty state: connected but no events yet
            emptyState
        } else if viewModel.events.isEmpty && viewModel.connectionState == .disconnected {
            // Disconnected with no events
            disconnectedState
        } else {
            // Events list
            eventsList
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "waveform")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
                .symbolEffect(.variableColor.iterative, options: .repeating)
            Text("Listening for detections...")
                .font(.headline)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Disconnected State

    private var disconnectedState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "wifi.slash")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("Disconnected")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Return to the app to reconnect")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Events List

    private var eventsList: some View {
        ScrollViewReader { proxy in
            List {
                ForEach(viewModel.events) { event in
                    DetectionRowView(event: event)
                        .id(event.id)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.visible)
                        .onAppear {
                            // Track if the first item is visible (user is at top)
                            if event.id == viewModel.events.first?.id {
                                viewModel.isAtTop = true
                            }
                        }
                        .onDisappear {
                            // If the first item disappears, user has scrolled down
                            if event.id == viewModel.events.first?.id {
                                viewModel.isAtTop = false
                            }
                        }
                }
            }
            .listStyle(.plain)
            .onChange(of: scrollTarget) { _, target in
                guard let target else { return }
                withAnimation(.easeInOut(duration: 0.3)) {
                    proxy.scrollTo(target, anchor: .top)
                }
                scrollTarget = nil
            }
        }
    }

    // MARK: - Connection Indicator

    /// Small colored circle in the toolbar indicating SSE connection state.
    private var connectionIndicator: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(connectionColor)
                .frame(width: 8, height: 8)
            if viewModel.connectionState == .reconnecting {
                Text("Reconnecting...")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var connectionColor: Color {
        switch viewModel.connectionState {
        case .connected:
            return .green
        case .disconnected:
            return .gray
        case .reconnecting:
            return .orange
        }
    }

    // MARK: - Actions

    /// Connect to the SSE live-feed endpoint.
    private func connectToFeed() async {
        guard let token = KeychainHelper.read(key: "accessToken") else { return }
        await viewModel.connect(token: token)
    }

    /// Handle app lifecycle changes for SSE connection management.
    private func handleScenePhaseChange(_ phase: ScenePhase) {
        switch phase {
        case .background:
            viewModel.scheduleDisconnect(after: 30)
        case .active:
            viewModel.cancelScheduledDisconnect()
            if viewModel.connectionState == .disconnected {
                guard let token = KeychainHelper.read(key: "accessToken") else { return }
                Task { await viewModel.reconnect(token: token) }
            }
        default:
            break
        }
    }

    /// Scroll to the top of the list and reset new event counter.
    private func scrollToTop() {
        if let firstId = viewModel.events.first?.id {
            scrollTarget = firstId
        }
        viewModel.scrollToTop()
        viewModel.isAtTop = true
    }
}
