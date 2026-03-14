import Foundation

enum APIEndpoint: Sendable {
    // Health
    case health

    // Detections (Phase 6)
    // case detections(page: Int, perPage: Int)
    // case detectionsByDateRange(from: Date, to: Date)

    var path: String {
        switch self {
        case .health:
            return "/health"
        }
    }

    var method: HTTPMethod {
        switch self {
        case .health:
            return .GET
        }
    }

    var body: Data? {
        switch self {
        case .health:
            return nil
        }
    }
}
