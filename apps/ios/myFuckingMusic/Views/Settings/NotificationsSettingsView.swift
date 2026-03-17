import SwiftUI

/// Notification preferences view with daily/weekly digest toggles.
/// Shows a warning hint when push permissions are denied.
struct NotificationsSettingsView: View {
    @State private var viewModel = NotificationsViewModel()
    @Environment(NotificationManager.self) private var notificationManager

    var body: some View {
        @Bindable var viewModel = viewModel

        List {
            // Digest toggles
            Section {
                Toggle("Daily Digest", isOn: $viewModel.dailyDigestEnabled)
                    .foregroundStyle(Color.rbTextPrimary)
                    .tint(Color.rbAccent)
                    .onChange(of: viewModel.dailyDigestEnabled) {
                        Task { await viewModel.updatePreferences() }
                    }
                    .listRowBackground(Color.rbSurface)

                Toggle("Weekly Digest", isOn: $viewModel.weeklyDigestEnabled)
                    .foregroundStyle(Color.rbTextPrimary)
                    .tint(Color.rbAccent)
                    .onChange(of: viewModel.weeklyDigestEnabled) {
                        Task { await viewModel.updatePreferences() }
                    }
                    .listRowBackground(Color.rbSurface)
            } header: {
                Text("Notifications")
                    .foregroundStyle(Color.rbTextSecondary)
            } footer: {
                Text("Digests are sent at 9:00 AM Romania time.")
                    .foregroundStyle(Color.rbTextTertiary)
            }

            // Permission denied hint
            if notificationManager.pushPermissionDenied {
                Section {
                    Label {
                        Text("Push notifications are disabled. Enable them in iOS Settings to receive digests.")
                            .font(.subheadline)
                            .foregroundStyle(Color.rbTextSecondary)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundStyle(Color.rbWarning)
                    }
                    .listRowBackground(Color.rbSurface)
                }
            }

            // Error display
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
        .navigationTitle("Notifications")
        .toolbarColorScheme(.dark, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task {
            await viewModel.loadPreferences()
            await notificationManager.checkPermissionStatus()
        }
    }
}

#Preview {
    NavigationStack {
        NotificationsSettingsView()
            .environment(NotificationManager())
    }
}
