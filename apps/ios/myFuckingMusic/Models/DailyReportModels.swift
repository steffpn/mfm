import Foundation

struct DailyReport: Codable, Identifiable, Sendable {
    let id: Int
    let userId: Int
    let reportDate: Date
    let content: DailyReportContent
    let tips: [String]
    let isPremium: Bool
    let deliveredVia: [String]
    let sentAt: Date
}

// The content varies by role but we decode as a flexible struct
struct DailyReportContent: Codable, Sendable {
    let totalPlays: Int?
    let yesterdayPlays: Int?
    let dayBeforePlays: Int?
    let weekOverWeekPercent: Int?
    let totalArtists: Int?
    let uniqueSongs: Int?
    let discoveryScore: Int?
}

struct DailyReportResponse: Codable, Sendable {
    let report: DailyReport?
    let message: String?
}
