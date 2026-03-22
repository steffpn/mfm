import Foundation

struct ChartAlert: Codable, Identifiable, Sendable {
    let id: Int
    let userId: Int
    let songTitle: String
    let artistName: String
    let isrc: String?
    let platform: String
    let country: String
    let chartName: String
    let position: Int
    let alertType: String
    let message: String
    let isRead: Bool
    let sentAt: Date
}
