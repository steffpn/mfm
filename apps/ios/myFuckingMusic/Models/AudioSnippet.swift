import Foundation

/// Mirrors `AudioSnippet` from packages/shared/src/types/snippet.ts
struct AudioSnippet: Codable, Identifiable, Sendable {
    let id: Int
    let detectionId: Int
    let stationId: Int
    let storageKey: String
    let durationMs: Int
    let encoding: String
    let bitrate: Int
    let sizeBytes: Int
    let presignedUrl: String?
    let createdAt: Date
}
