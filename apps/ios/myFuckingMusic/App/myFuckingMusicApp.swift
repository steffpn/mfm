import SwiftUI

@main
struct myFuckingMusicApp: App {
    @State private var authManager = AuthManager()
    @State private var audioPlayer = AudioPlayerManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(authManager)
                .environment(audioPlayer)
                .task {
                    // Configure APIClient with auth manager for 401 retry
                    await APIClient.shared.configure(authManager: authManager)
                }
        }
    }
}
