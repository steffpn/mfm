import Foundation

/// URLSession-based API client with async/await.
/// No third-party dependencies (no Alamofire) per locked decisions.
actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private var baseURL: URL

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        // Default to localhost for development
        self.baseURL = URL(string: "http://localhost:3000/api/v1")!
    }

    func setBaseURL(_ url: URL) {
        self.baseURL = url
    }

    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        let url = baseURL.appendingPathComponent(endpoint.path)
        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue

        if let body = endpoint.body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        // Auth token will be added in Phase 5
        // if let token = TokenStorage.accessToken {
        //     request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        // }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode, data: data)
        }

        return try decoder.decode(T.self, from: data)
    }
}

enum HTTPMethod: String, Sendable {
    case GET, POST, PUT, PATCH, DELETE
}

enum APIError: Error, LocalizedError, Sendable {
    case invalidResponse
    case httpError(statusCode: Int, data: Data)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .httpError(let code, _):
            return "HTTP error: \(code)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        }
    }
}
