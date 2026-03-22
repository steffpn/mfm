import Foundation

struct SubscriptionInfo: Codable, Sendable {
    let subscription: SubscriptionDetail?
    let plan: PlanInfo?
    let features: [String]
}

struct SubscriptionDetail: Codable, Sendable {
    let id: Int
    let status: String
    let billingInterval: String
    let trialEndsAt: Date?
    let currentPeriodEnd: Date?
    let cancelAtPeriodEnd: Bool
    let seatCount: Int
}

struct PlanInfo: Codable, Sendable {
    let id: Int
    let name: String
    let slug: String
    let tier: String
}

struct CheckoutResponse: Codable, Sendable {
    let checkoutUrl: String
}

struct PortalResponse: Codable, Sendable {
    let portalUrl: String
}
