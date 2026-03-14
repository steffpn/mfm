import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "music.note.list")
                .font(.system(size: 64))
                .foregroundStyle(.tint)

            Text("myFuckingMusic")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Radio & TV Detection Dashboard")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
