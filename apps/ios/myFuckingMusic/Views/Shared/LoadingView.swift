import SwiftUI

/// Reusable loading placeholder with spinner and text.
/// Centered in parent. Used across multiple views for consistent loading UX.
struct LoadingView: View {
    var message: String = "Loading..."

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .controlSize(.large)
                .tint(Color.rbAccent)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.rbBackground)
    }
}

#Preview {
    LoadingView()
}
