import SwiftUI

/// Settings for daily report configuration.
/// Allows enabling/disabling reports, setting delivery time, and timezone.
struct DailyReportSettingsView: View {
    @State private var viewModel = SettingsViewModel()

    private let timezones = [
        "Europe/Bucharest",
        "Europe/London",
        "Europe/Berlin",
        "Europe/Paris",
        "Europe/Madrid",
        "Europe/Rome",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Asia/Tokyo",
        "Asia/Shanghai",
        "Australia/Sydney",
    ]

    /// Convert stored HH:mm string to a Date for the DatePicker.
    private var timeBinding: Binding<Date> {
        Binding<Date>(
            get: {
                let parts = viewModel.dailyReportTime.split(separator: ":")
                let hour = Int(parts.first ?? "9") ?? 9
                let minute = Int(parts.last ?? "0") ?? 0
                var components = DateComponents()
                components.hour = hour
                components.minute = minute
                return Calendar.current.date(from: components) ?? Date()
            },
            set: { newDate in
                let components = Calendar.current.dateComponents([.hour, .minute], from: newDate)
                let hour = components.hour ?? 9
                let minute = components.minute ?? 0
                viewModel.dailyReportTime = String(format: "%02d:%02d", hour, minute)
                Task { await viewModel.updateDailyReportSettings() }
            }
        )
    }

    var body: some View {
        List {
            Section {
                Toggle("Enable Daily Report", isOn: Bindable(viewModel).dailyReportEnabled)
                    .foregroundStyle(Color.rbTextPrimary)
                    .tint(Color.rbAccent)
                    .onChange(of: viewModel.dailyReportEnabled) {
                        Task { await viewModel.updateDailyReportSettings() }
                    }
                    .listRowBackground(Color.rbSurface)
            } header: {
                Text("Daily Report")
                    .foregroundStyle(Color.rbTextSecondary)
            } footer: {
                Text("Receive a daily summary of your play stats, tips, and insights.")
                    .foregroundStyle(Color.rbTextTertiary)
            }

            if viewModel.dailyReportEnabled {
                Section {
                    DatePicker("Delivery Time", selection: timeBinding, displayedComponents: .hourAndMinute)
                        .foregroundStyle(Color.rbTextPrimary)
                        .tint(Color.rbAccent)
                        .listRowBackground(Color.rbSurface)

                    Picker("Timezone", selection: Bindable(viewModel).dailyReportTimezone) {
                        ForEach(timezones, id: \.self) { tz in
                            Text(tz.replacingOccurrences(of: "_", with: " "))
                                .tag(tz)
                        }
                    }
                    .foregroundStyle(Color.rbTextPrimary)
                    .onChange(of: viewModel.dailyReportTimezone) {
                        Task { await viewModel.updateDailyReportSettings() }
                    }
                    .listRowBackground(Color.rbSurface)
                } header: {
                    Text("Schedule")
                        .foregroundStyle(Color.rbTextSecondary)
                }
            }

            if let error = viewModel.error {
                Section {
                    Text(error)
                        .foregroundStyle(Color.rbError)
                        .font(.caption)
                        .listRowBackground(Color.rbSurface)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.rbBackground)
        .navigationTitle("Daily Report")
        .toolbarColorScheme(.dark, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task {
            await viewModel.loadSettings()
        }
    }
}

#Preview {
    NavigationStack {
        DailyReportSettingsView()
    }
}
