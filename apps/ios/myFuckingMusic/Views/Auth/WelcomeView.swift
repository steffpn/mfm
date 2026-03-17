import SwiftUI

/// Full-screen welcome splash shown on first launch.
/// Provides navigation to invite code entry or login.
struct WelcomeView: View {
    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // App icon
                ZStack {
                    Circle()
                        .fill(Color.rbSurface)
                        .frame(width: 120, height: 120)

                    Circle()
                        .stroke(LinearGradient.rbAccentGradient, lineWidth: 2)
                        .frame(width: 120, height: 120)

                    Image(systemName: "antenna.radiowaves.left.and.right")
                        .font(.system(size: 48, weight: .medium))
                        .foregroundStyle(LinearGradient.rbAccentGradient)
                }

                // App title
                VStack(spacing: 10) {
                    Text("RadioBug")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.rbTextPrimary)

                    Text("Monitor every beat on every station")
                        .font(.subheadline)
                        .foregroundStyle(Color.rbTextSecondary)
                }

                Spacer()

                // Navigation buttons
                VStack(spacing: 16) {
                    NavigationLink {
                        InviteCodeView()
                    } label: {
                        Text("I have an invite code")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(LinearGradient.rbAccentGradient)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    NavigationLink {
                        LoginView()
                    } label: {
                        Text("Already have an account? Log in")
                            .font(.subheadline)
                            .foregroundStyle(Color.rbAccent)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
            }
        }
        .navigationBarBackButtonHidden(true)
    }
}

#Preview {
    NavigationStack {
        WelcomeView()
    }
}
