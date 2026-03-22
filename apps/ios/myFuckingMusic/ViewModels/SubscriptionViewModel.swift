import Foundation

/// ViewModel for subscription management.
@MainActor
@Observable
final class SubscriptionViewModel {
    var subscriptionInfo: SubscriptionInfo?
    var isLoading: Bool = false
    var error: String?
    var checkoutURL: URL?
    var portalURL: URL?

    var isFreeTier: Bool {
        subscriptionInfo?.plan == nil || subscriptionInfo?.plan?.tier == "free"
    }

    /// Fetch current subscription info.
    func loadSubscription() async {
        isLoading = true
        error = nil
        do {
            subscriptionInfo = try await APIClient.shared.request(.mySubscription)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    /// Create a checkout session for upgrading.
    func createCheckout(planId: Int, billingInterval: String = "month") async {
        do {
            let response: CheckoutResponse = try await APIClient.shared.request(
                .createCheckout(
                    planId: planId,
                    billingInterval: billingInterval,
                    successUrl: "radiobug://subscription/success",
                    cancelUrl: "radiobug://subscription/cancel"
                )
            )
            checkoutURL = URL(string: response.checkoutUrl)
        } catch {
            self.error = "Failed to create checkout session"
        }
    }

    /// Create a customer portal session.
    func createPortal() async {
        do {
            let response: PortalResponse = try await APIClient.shared.request(
                .createPortal(returnUrl: "radiobug://subscription")
            )
            portalURL = URL(string: response.portalUrl)
        } catch {
            self.error = "Failed to open billing portal"
        }
    }
}
