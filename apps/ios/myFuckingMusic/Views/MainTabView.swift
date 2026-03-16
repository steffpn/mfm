import SwiftUI

/// Main tab bar navigation.
/// Shown when user is authenticated.
/// Tabs: Dashboard, Detections, Search, Settings.
struct MainTabView: View {
    var body: some View {
        TabView {
            // Dashboard tab
            NavigationStack {
                DashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "house.fill")
            }

            // Detections tab
            DetectionsView()
                .tabItem {
                    Label("Detections", systemImage: "list.bullet")
                }

            // Search tab
            SearchView()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }

            // Settings tab
            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
        }
    }
}

#Preview {
    MainTabView()
        .environment(AuthManager())
}
