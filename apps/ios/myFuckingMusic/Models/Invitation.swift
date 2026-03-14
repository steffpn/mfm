import Foundation

/// Mirrors `Invitation` from packages/shared/src/types/invitation.ts
struct Invitation: Codable, Identifiable, Sendable {
    let id: Int
    let code: String
    let role: UserRole
    let scopeId: Int?
    let status: InvitationStatus
    let createdBy: Int
    let redeemedBy: Int?
    let expiresAt: Date
    let createdAt: Date
    let redeemedAt: Date?
}

enum InvitationStatus: String, Codable, Sendable {
    case pending = "PENDING"
    case redeemed = "REDEEMED"
    case expired = "EXPIRED"
    case revoked = "REVOKED"
}
