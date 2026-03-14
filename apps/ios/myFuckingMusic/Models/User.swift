import Foundation

/// Mirrors `User` from packages/shared/src/types/user.ts
struct User: Codable, Identifiable, Sendable {
    let id: Int
    let email: String
    let name: String
    let role: UserRole
    let scopeId: Int?
    let isActive: Bool
    let lastLoginAt: Date?
    let createdAt: Date
    let updatedAt: Date
}

enum UserRole: String, Codable, Sendable {
    case admin = "ADMIN"
    case artist = "ARTIST"
    case label = "LABEL"
    case station = "STATION"
}
