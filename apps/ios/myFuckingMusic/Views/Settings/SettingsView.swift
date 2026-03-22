import SwiftUI

/// Settings tab showing user info and logout button.
struct SettingsView: View {
    @Environment(AuthManager.self) private var authManager

    @State private var isLoggingOut = false

    var body: some View {
        List {
            // User info section
            Section {
                if let user = authManager.currentUser {
                    HStack {
                        Text("Name")
                            .foregroundStyle(Color.rbTextPrimary)
                        Spacer()
                        Text(user.name)
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                    .listRowBackground(Color.rbSurface)

                    HStack {
                        Text("Email")
                            .foregroundStyle(Color.rbTextPrimary)
                        Spacer()
                        Text(user.email)
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                    .listRowBackground(Color.rbSurface)

                    HStack {
                        Text("Role")
                            .foregroundStyle(Color.rbTextPrimary)
                        Spacer()
                        Text(user.role.capitalized)
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                    .listRowBackground(Color.rbSurface)
                } else {
                    Text("Not signed in")
                        .foregroundStyle(Color.rbTextSecondary)
                        .listRowBackground(Color.rbSurface)
                }
            } header: {
                Text("Account")
                    .foregroundStyle(Color.rbTextSecondary)
            }

            // App info section
            Section {
                NavigationLink {
                    NotificationsSettingsView()
                } label: {
                    Label("Notifications", systemImage: "bell")
                        .foregroundStyle(Color.rbTextPrimary)
                }
                .listRowBackground(Color.rbSurface)

                NavigationLink {
                    DailyReportSettingsView()
                } label: {
                    Label("Daily Report", systemImage: "doc.text")
                        .foregroundStyle(Color.rbTextPrimary)
                }
                .listRowBackground(Color.rbSurface)

                if let role = authManager.currentUser?.role.uppercased(),
                   role == "ARTIST" || role == "LABEL" {
                    NavigationLink {
                        ChartAlertSettingsView()
                    } label: {
                        Label("Chart Alerts", systemImage: "chart.line.uptrend.xyaxis")
                            .foregroundStyle(Color.rbTextPrimary)
                    }
                    .listRowBackground(Color.rbSurface)
                }

                if authManager.currentUser?.role.uppercased() == "STATION" {
                    NavigationLink {
                        CompetitorListView()
                    } label: {
                        Label("Competitor Stations", systemImage: "antenna.radiowaves.left.and.right")
                            .foregroundStyle(Color.rbTextPrimary)
                    }
                    .listRowBackground(Color.rbSurface)
                }

                HStack {
                    Text("Version")
                        .foregroundStyle(Color.rbTextPrimary)
                    Spacer()
                    Text("1.0")
                        .foregroundStyle(Color.rbTextSecondary)
                }
                .listRowBackground(Color.rbSurface)
            } header: {
                Text("RadioBug")
                    .foregroundStyle(Color.rbTextSecondary)
            }

            // Plan & Billing section
            Section {
                NavigationLink {
                    SubscriptionView()
                } label: {
                    Label("Subscription", systemImage: "creditcard")
                        .foregroundStyle(Color.rbTextPrimary)
                }
                .listRowBackground(Color.rbSurface)
            } header: {
                Text("Plan & Billing")
                    .foregroundStyle(Color.rbTextSecondary)
            }

            // Logout section
            Section {
                Button(role: .destructive) {
                    isLoggingOut = true
                    Task {
                        await authManager.logout()
                        isLoggingOut = false
                    }
                } label: {
                    HStack {
                        Spacer()
                        if isLoggingOut {
                            ProgressView()
                                .tint(Color.rbError)
                        } else {
                            Text("Log Out")
                                .foregroundStyle(Color.rbError)
                                .fontWeight(.semibold)
                        }
                        Spacer()
                    }
                }
                .disabled(isLoggingOut)
                .listRowBackground(Color.rbSurface)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.rbBackground)
        .navigationTitle("Settings")
        .toolbarColorScheme(.dark, for: .navigationBar)
        .preferredColorScheme(.dark)
    }
}

#Preview {
    NavigationStack {
        SettingsView()
            .environment(AuthManager())
    }
}
