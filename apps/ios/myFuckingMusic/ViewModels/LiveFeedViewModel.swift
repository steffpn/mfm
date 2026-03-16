import Foundation
import SwiftUI

/// ViewModel for the live feed tab.
/// Manages SSE connection lifecycle, 50-item event buffer, scroll-aware new event counting,
/// and background disconnect scheduling.
@MainActor
@Observable
final class LiveFeedViewModel {
    var events: [AirplayEvent] = []
    var connectionState: ConnectionState = .disconnected
    var newEventCount = 0   // Events arrived while user is scrolled down
    var isAtTop = true      // Track if user is at top of list

    private let sseClient = SSEClient()
    private let maxEvents = 50
    private var disconnectTask: Task<Void, Never>?
    private var connectTask: Task<Void, Never>?

    enum ConnectionState: Sendable {
        case connected, disconnected, reconnecting
    }

    // MARK: - Connect

    /// Connect to the SSE live-feed endpoint and start receiving events.
    /// Events are inserted at the top of the list with animation when user is at top,
    /// or silently when scrolled down (incrementing newEventCount).
    func connect(token: String) async {
        connectionState = .connected
        connectTask?.cancel()

        let baseURL = await APIClient.shared.getBaseURL()
        // Strip /v1 suffix to get the API root (SSEClient appends v1/live-feed)
        let apiRoot: URL
        if baseURL.lastPathComponent == "v1" {
            apiRoot = baseURL.deletingLastPathComponent()
        } else {
            apiRoot = baseURL
        }

        let stream = await sseClient.connect(baseURL: apiRoot, token: token)

        let task = Task {
            for await event in stream {
                if Task.isCancelled { break }

                if isAtTop {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        events.insert(event, at: 0)
                        if events.count > maxEvents {
                            events.removeLast(events.count - maxEvents)
                        }
                    }
                } else {
                    events.insert(event, at: 0)
                    if events.count > maxEvents {
                        events.removeLast(events.count - maxEvents)
                    }
                    newEventCount += 1
                }
            }

            // Stream ended
            if !Task.isCancelled {
                connectionState = .disconnected
            }
        }
        connectTask = task
    }

    // MARK: - Reconnect

    /// Reconnect to the SSE endpoint. SSEClient automatically sends Last-Event-ID for backfill.
    func reconnect(token: String) async {
        connectionState = .reconnecting
        await connect(token: token)
    }

    // MARK: - Scroll Management

    /// Reset new event counter when user scrolls to top.
    func scrollToTop() {
        newEventCount = 0
    }

    // MARK: - Background Disconnect Scheduling

    /// Schedule a disconnect after the given number of seconds.
    /// Used when the app enters background (~30 seconds).
    func scheduleDisconnect(after seconds: Int) {
        disconnectTask?.cancel()
        disconnectTask = Task {
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            connectTask?.cancel()
            await sseClient.disconnect()
            connectionState = .disconnected
        }
    }

    /// Cancel a pending scheduled disconnect (e.g., when app returns to foreground quickly).
    func cancelScheduledDisconnect() {
        disconnectTask?.cancel()
        disconnectTask = nil
    }

    // MARK: - Disconnect

    /// Immediately disconnect from the SSE stream.
    func disconnect() {
        connectTask?.cancel()
        connectTask = nil
        Task { await sseClient.disconnect() }
        connectionState = .disconnected
    }
}
