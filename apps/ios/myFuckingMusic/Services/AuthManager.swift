import Foundation

/// Manages authentication state, token lifecycle, and silent refresh.
/// @MainActor for UI-safe property updates. Uses @Observable for SwiftUI binding.
@MainActor
@Observable
final class AuthManager {
    var isAuthenticated = false
    var currentUser: AuthUser?
    var isLoading = false

    /// Actor-based single-flight token refresh to coalesce concurrent refresh calls.
    private var refreshTask: Task<String, Error>?

    // MARK: - Stored Token Check

    /// Called on app launch to check for existing valid tokens.
    /// If tokens exist, attempts a silent refresh to validate them.
    func checkStoredTokens() async {
        isLoading = true
        defer { isLoading = false }

        guard let _ = KeychainHelper.read(key: "accessToken"),
              let refreshToken = KeychainHelper.read(key: "refreshToken") else {
            isAuthenticated = false
            return
        }

        // Attempt token refresh to validate stored tokens
        do {
            _ = try await performRefresh(refreshToken)
            isAuthenticated = true
        } catch {
            clearTokens()
            isAuthenticated = false
        }
    }

    // MARK: - Register

    /// Register a new user with invite code.
    /// On success: stores tokens, sets currentUser, sets isAuthenticated.
    func register(code: String, email: String, password: String, name: String) async throws {
        let response: AuthResponse = try await APIClient.shared.request(
            .register(code: code, email: email, password: password, name: name)
        )

        storeTokens(accessToken: response.accessToken, refreshToken: response.refreshToken)
        currentUser = response.user
        isAuthenticated = true
    }

    // MARK: - Login

    /// Login with email and password.
    /// On success: stores tokens, sets currentUser, sets isAuthenticated.
    func login(email: String, password: String) async throws {
        let response: AuthResponse = try await APIClient.shared.request(
            .login(email: email, password: password)
        )

        storeTokens(accessToken: response.accessToken, refreshToken: response.refreshToken)
        currentUser = response.user
        isAuthenticated = true
    }

    // MARK: - Logout

    /// Logout: revokes refresh token on server (best-effort), clears local tokens.
    func logout() async {
        // Best-effort server logout -- don't fail on network error
        if let refreshToken = KeychainHelper.read(key: "refreshToken") {
            let _: LogoutResponse? = try? await APIClient.shared.request(
                .logout(refreshToken: refreshToken)
            )
        }

        clearTokens()
        currentUser = nil
        isAuthenticated = false
    }

    // MARK: - Token Refresh

    /// Single-flight token refresh. Coalesces concurrent refresh calls.
    /// Returns the new access token.
    @discardableResult
    nonisolated func refreshAccessToken() async throws -> String {
        // If there's already a refresh in flight, await its result
        if let existingTask = await getRefreshTask() {
            return try await existingTask.value
        }

        let task = Task<String, Error> { @MainActor in
            defer { self.refreshTask = nil }

            guard let refreshToken = KeychainHelper.read(key: "refreshToken") else {
                throw AuthError.notAuthenticated
            }

            return try await self.performRefresh(refreshToken)
        }

        await setRefreshTask(task)
        return try await task.value
    }

    // MARK: - Private Helpers

    private func performRefresh(_ refreshToken: String) async throws -> String {
        let response: TokenResponse = try await APIClient.shared.requestWithoutAuth(
            .refresh(refreshToken: refreshToken)
        )

        storeTokens(accessToken: response.accessToken, refreshToken: response.refreshToken)
        return response.accessToken
    }

    private func storeTokens(accessToken: String, refreshToken: String) {
        KeychainHelper.save(key: "accessToken", value: accessToken)
        KeychainHelper.save(key: "refreshToken", value: refreshToken)
    }

    private func clearTokens() {
        KeychainHelper.clearAll()
    }

    private func getRefreshTask() -> Task<String, Error>? {
        refreshTask
    }

    private func setRefreshTask(_ task: Task<String, Error>) {
        refreshTask = task
    }
}

// MARK: - Auth Errors

enum AuthError: Error, LocalizedError, Sendable {
    case notAuthenticated
    case invalidCredentials
    case registrationFailed(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Not authenticated"
        case .invalidCredentials:
            return "Invalid credentials"
        case .registrationFailed(let message):
            return message
        }
    }
}
