import SwiftUI

/// Main tab bar navigation.
/// Shown when user is authenticated.
/// Shows different tabs based on user role: ARTIST, LABEL, STATION, or ADMIN (default).
struct MainTabView: View {
    @Environment(AuthManager.self) private var authManager

    init() {
        // Style the tab bar for the dark theme
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color.rbBackground)

        // Normal state
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor(Color.rbTextTertiary)
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(Color.rbTextTertiary)
        ]

        // Selected state
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor(Color.rbAccent)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(Color.rbAccent)
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        Group {
            switch authManager.currentUser?.role.uppercased() ?? "" {
            case "ARTIST":
                artistTabs
            case "LABEL":
                labelTabs
            case "STATION":
                stationTabs
            default:
                adminTabs
            }
        }
        .tint(Color.rbAccent)
        .preferredColorScheme(.dark)
        .safeAreaInset(edge: .bottom) {
            NowPlayingBar()
        }
    }

    // MARK: - Artist Tabs

    private var artistTabs: some View {
        TabView {
            NavigationStack {
                ArtistDashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "chart.bar.fill")
            }

            NavigationStack {
                MonitoredSongsView()
            }
            .tabItem {
                Label("My Songs", systemImage: "music.note.list")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }
        }
    }

    // MARK: - Label Tabs

    private var labelTabs: some View {
        TabView {
            NavigationStack {
                LabelDashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "chart.bar.fill")
            }

            NavigationStack {
                LabelArtistListView()
            }
            .tabItem {
                Label("My Artists", systemImage: "person.2.fill")
            }

            NavigationStack {
                LabelInsightsView()
            }
            .tabItem {
                Label("Insights", systemImage: "lightbulb.fill")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }
        }
    }

    // MARK: - Station Tabs

    private var stationTabs: some View {
        TabView {
            NavigationStack {
                StationDashboardView()
            }
            .tabItem {
                Label("My Station", systemImage: "antenna.radiowaves.left.and.right")
            }

            NavigationStack {
                CompetitorListView()
            }
            .tabItem {
                Label("Competitors", systemImage: "person.2.wave.2.fill")
            }

            NavigationStack {
                StationAnalyticsMenuView()
            }
            .tabItem {
                Label("Analytics", systemImage: "chart.xyaxis.line")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }
        }
    }

    // MARK: - Admin Tabs (Default)

    private var adminTabs: some View {
        TabView {
            NavigationStack {
                DashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "waveform")
            }

            DetectionsView()
                .tabItem {
                    Label("Detections", systemImage: "antenna.radiowaves.left.and.right")
                }

            ArtistListView()
                .tabItem {
                    Label("Artists", systemImage: "person.2.fill")
                }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }
        }
    }
}

// MARK: - Label Insights Sub-Navigation

/// Sub-navigation view for label insights tab.
/// Provides access to Station Affinity and Artist Comparison views.
private struct LabelInsightsView: View {
    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            List {
                Section {
                    NavigationLink {
                        StationAffinityView()
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Station Affinity")
                                    .foregroundStyle(Color.rbTextPrimary)
                                Text("Which stations play your music most")
                                    .font(.caption)
                                    .foregroundStyle(Color.rbTextTertiary)
                            }
                        } icon: {
                            Image(systemName: "antenna.radiowaves.left.and.right")
                                .foregroundStyle(Color.rbAccent)
                        }
                    }
                    .listRowBackground(Color.rbSurface)

                    NavigationLink {
                        ArtistComparisonView()
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Compare Artists")
                                    .foregroundStyle(Color.rbTextPrimary)
                                Text("Side-by-side artist performance")
                                    .font(.caption)
                                    .foregroundStyle(Color.rbTextTertiary)
                            }
                        } icon: {
                            Image(systemName: "chart.bar.xaxis")
                                .foregroundStyle(Color.rbWarm)
                        }
                    }
                    .listRowBackground(Color.rbSurface)
                } header: {
                    Text("Analysis")
                        .foregroundStyle(Color.rbTextSecondary)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Insights")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Station Analytics Sub-Navigation

/// Sub-navigation view for station analytics tab.
/// Provides access to Playlist Overlap, Rotation Analysis, and Discovery Score views.
private struct StationAnalyticsMenuView: View {
    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            List {
                Section {
                    NavigationLink {
                        PlaylistOverlapView()
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Playlist Overlap")
                                    .foregroundStyle(Color.rbTextPrimary)
                                Text("Compare playlists with competitors")
                                    .font(.caption)
                                    .foregroundStyle(Color.rbTextTertiary)
                            }
                        } icon: {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .foregroundStyle(Color.rbAccent)
                        }
                    }
                    .listRowBackground(Color.rbSurface)

                    NavigationLink {
                        RotationAnalysisView()
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Rotation Analysis")
                                    .foregroundStyle(Color.rbTextPrimary)
                                Text("Song rotation patterns and alerts")
                                    .font(.caption)
                                    .foregroundStyle(Color.rbTextTertiary)
                            }
                        } icon: {
                            Image(systemName: "arrow.clockwise")
                                .foregroundStyle(Color.rbWarm)
                        }
                    }
                    .listRowBackground(Color.rbSurface)

                    NavigationLink {
                        DiscoveryScoreView()
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Discovery Score")
                                    .foregroundStyle(Color.rbTextPrimary)
                                Text("How much new music you play")
                                    .font(.caption)
                                    .foregroundStyle(Color.rbTextTertiary)
                            }
                        } icon: {
                            Image(systemName: "sparkles")
                                .foregroundStyle(.purple)
                        }
                    }
                    .listRowBackground(Color.rbSurface)

                    NavigationLink {
                        NewSongsView()
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("New Songs")
                                    .foregroundStyle(Color.rbTextPrimary)
                                Text("Songs appearing for the first time")
                                    .font(.caption)
                                    .foregroundStyle(Color.rbTextTertiary)
                            }
                        } icon: {
                            Image(systemName: "star.fill")
                                .foregroundStyle(.green)
                        }
                    }
                    .listRowBackground(Color.rbSurface)
                } header: {
                    Text("Analytics")
                        .foregroundStyle(Color.rbTextSecondary)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
    }
}

#Preview {
    MainTabView()
        .environment(AuthManager())
}
