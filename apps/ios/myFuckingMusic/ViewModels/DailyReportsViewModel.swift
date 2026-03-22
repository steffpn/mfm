import Foundation

/// ViewModel for daily reports.
@MainActor
@Observable
final class DailyReportsViewModel {
    var todayReport: DailyReport?
    var pastReports: [DailyReport] = []
    var isLoading: Bool = false
    var error: String?

    /// Fetch today's report from the backend.
    func loadTodayReport() async {
        do {
            let response: DailyReportResponse = try await APIClient.shared.request(.todayReport)
            todayReport = response.report
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Fetch past reports from the backend.
    func loadPastReports() async {
        do {
            pastReports = try await APIClient.shared.request(
                .dailyReports(limit: 30)
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Load both today's report and history.
    func loadAll() async {
        isLoading = true
        error = nil
        await loadTodayReport()
        await loadPastReports()
        isLoading = false
    }
}
