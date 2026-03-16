import Foundation

/// Response from POST /auth/register and POST /auth/login
struct AuthResponse: Codable, Sendable {
    let user: AuthUser
    let accessToken: String
    let refreshToken: String
}

/// User data returned in auth responses.
/// Subset of the full User model -- only public fields.
struct AuthUser: Codable, Sendable {
    let id: Int
    let email: String
    let name: String
    let role: String
}

/// Response from POST /auth/refresh
struct TokenResponse: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
}

/// Error response from backend
struct ErrorResponse: Codable, Sendable {
    let error: String
}

/// Response from POST /auth/logout
struct LogoutResponse: Codable, Sendable {
    let message: String
}

/// Response from GET /airplay-events/:id/snippet
struct SnippetUrlResponse: Codable, Sendable {
    let url: String
    let expiresIn: Int
}
