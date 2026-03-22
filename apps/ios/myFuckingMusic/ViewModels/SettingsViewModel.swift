import Foundation

/// ViewModel for user settings management (daily reports, chart alerts).
@MainActor
@Observable
final class SettingsViewModel {
    var dailyReportEnabled: Bool = false
    var dailyReportTime: String = "09:00"
    var dailyReportTimezone: String = "Europe/Bucharest"
    var chartAlertsEnabled: Bool = false
    var chartAlertCountries: [String] = []
    var isLoading: Bool = false
    var error: String?

    /// Fetch current settings from the backend.
    func loadSettings() async {
        isLoading = true
        error = nil
        do {
            let settings: UserSettings = try await APIClient.shared.request(.userSettings)
            dailyReportEnabled = settings.dailyReportEnabled
            dailyReportTime = settings.dailyReportTime
            dailyReportTimezone = settings.dailyReportTimezone
            chartAlertsEnabled = settings.chartAlertsEnabled
            chartAlertCountries = settings.chartAlertCountries
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    /// Save daily report settings to the backend.
    func updateDailyReportSettings() async {
        do {
            let _: UserSettings = try await APIClient.shared.request(
                .updateSettings(
                    dailyReportTime: dailyReportTime,
                    dailyReportTimezone: dailyReportTimezone,
                    dailyReportEnabled: dailyReportEnabled,
                    chartAlertsEnabled: nil,
                    chartAlertCountries: nil
                )
            )
        } catch {
            self.error = "Failed to save settings"
        }
    }

    /// Save chart alert settings to the backend.
    func updateChartAlertSettings() async {
        do {
            let _: UserSettings = try await APIClient.shared.request(
                .updateSettings(
                    dailyReportTime: nil,
                    dailyReportTimezone: nil,
                    dailyReportEnabled: nil,
                    chartAlertsEnabled: chartAlertsEnabled,
                    chartAlertCountries: chartAlertCountries
                )
            )
        } catch {
            self.error = "Failed to save settings"
        }
    }
}
