import Foundation

/// ViewModel for chart alerts list.
@MainActor
@Observable
final class ChartAlertsViewModel {
    var alerts: [ChartAlert] = []
    var isLoading: Bool = false
    var error: String?
    var showUnreadOnly: Bool = false

    var filteredAlerts: [ChartAlert] {
        if showUnreadOnly {
            return alerts.filter { !$0.isRead }
        }
        return alerts
    }

    var unreadCount: Int {
        alerts.filter { !$0.isRead }.count
    }

    /// Fetch chart alerts from the backend.
    func loadAlerts() async {
        isLoading = true
        error = nil
        do {
            alerts = try await APIClient.shared.request(
                .chartAlerts(unreadOnly: false, limit: 100)
            )
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    /// Mark specific alerts as read.
    func markAsRead(_ alertIds: [Int]) async {
        do {
            let _: EmptyResponse = try await APIClient.shared.request(
                .markChartAlertsRead(alertIds: alertIds)
            )
            // Re-fetch to get updated state
            await loadAlerts()
        } catch {
            self.error = "Failed to mark alerts as read"
        }
    }
}
