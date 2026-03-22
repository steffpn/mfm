import Foundation

struct UserSettings: Codable, Sendable {
    let id: Int
    let userId: Int
    let dailyReportTime: String
    let dailyReportTimezone: String
    let dailyReportEnabled: Bool
    let chartAlertsEnabled: Bool
    let chartAlertCountries: [String]
    let createdAt: Date
    let updatedAt: Date
}
