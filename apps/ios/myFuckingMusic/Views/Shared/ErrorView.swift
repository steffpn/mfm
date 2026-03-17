import SwiftUI

/// Reusable error state view with icon, message, and retry button.
/// Centered in parent. Used across multiple views for consistent error UX.
struct ErrorView: View {
    let message: String
    let retryAction: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(Color.rbError)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button("Retry") {
                retryAction()
            }
            .buttonStyle(.bordered)
            .tint(Color.rbAccent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.rbBackground)
    }
}

#Preview {
    ErrorView(message: "Failed to load dashboard data.") {
        // retry
    }
}
