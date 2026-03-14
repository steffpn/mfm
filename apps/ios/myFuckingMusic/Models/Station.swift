import Foundation

/// Mirrors `Station` from packages/shared/src/types/station.ts
struct Station: Codable, Identifiable, Sendable {
    let id: Int
    let name: String
    let streamUrl: String
    let status: StreamStatus
    let country: String
    let stationType: StationType
    let lastHeartbeat: Date?
    let restartCount: Int
    let createdAt: Date
    let updatedAt: Date
}

enum StationType: String, Codable, Sendable {
    case radio
    case tv
}

enum StreamStatus: String, Codable, Sendable {
    case active = "ACTIVE"
    case inactive = "INACTIVE"
    case error = "ERROR"
    case restarting = "RESTARTING"
}
