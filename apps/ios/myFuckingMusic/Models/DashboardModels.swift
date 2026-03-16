import Foundation

/// Time period for dashboard queries.
/// Maps to backend ?period= query parameter values.
enum TimePeriod: String, CaseIterable, Sendable {
    case day
    case week
    case month

    /// Human-readable label for display in summary cards and headers.
    var displayLabel: String {
        switch self {
        case .day: return "Today"
        case .week: return "This Week"
        case .month: return "This Month"
        }
    }

    /// Calendar component used for chart axis formatting.
    var calendarComponent: Calendar.Component {
        switch self {
        case .day: return .hour
        case .week: return .day
        case .month: return .day
        }
    }
}

// MARK: - Dashboard Summary

/// Response from GET /dashboard/summary
struct DashboardSummaryResponse: Codable, Sendable {
    let buckets: [PlayCountBucket]
    let totals: PlayCountTotals
}

/// A single time bucket of play count data.
/// bucket is an ISO date string from the backend.
struct PlayCountBucket: Codable, Identifiable, Sendable {
    let bucket: String
    let playCount: Int
    let uniqueSongs: Int
    let uniqueArtists: Int

    var id: String { bucket }

    /// Parse the bucket ISO date string into a Date.
    var date: Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: bucket) {
            return date
        }
        // Try without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: bucket)
    }
}

/// Aggregate totals for the selected period.
struct PlayCountTotals: Codable, Sendable {
    let playCount: Int
    let uniqueSongs: Int
    let uniqueArtists: Int
}

// MARK: - Top Stations

/// Response from GET /dashboard/top-stations
struct TopStationsResponse: Codable, Sendable {
    let stations: [StationPlayCount]
}

/// A station with its play count for ranking.
struct StationPlayCount: Codable, Identifiable, Sendable {
    let stationId: Int
    let stationName: String
    let playCount: Int

    var id: Int { stationId }
}
