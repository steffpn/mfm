import SwiftUI

struct LoginView: View {
    @Environment(AuthViewModel.self) private var viewModel
    @State private var email = ""
    @State private var password = ""
    @State private var demoAccounts: [DemoAccount] = []
    @State private var showDemoAccounts = false

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    Spacer(minLength: 40)

                    Image(systemName: "person.circle")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.rbAccent)

                    Text("Welcome Back")
                        .font(.title2.bold())
                        .foregroundStyle(Color.rbTextPrimary)

                    Text("Log in to your account")
                        .font(.subheadline)
                        .foregroundStyle(Color.rbTextSecondary)

                    VStack(spacing: 16) {
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .modifier(AuthFieldStyle())

                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .modifier(AuthFieldStyle())
                    }
                    .padding(.horizontal, 24)

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .padding(.horizontal, 24)
                    }

                    Button {
                        loginWith(email: email, password: password)
                    } label: {
                        Group {
                            if viewModel.isSubmitting {
                                ProgressView().tint(.white)
                            } else {
                                Text("Log In")
                            }
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.rbAccent)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(viewModel.isSubmitting)
                    .padding(.horizontal, 24)

                    // Demo accounts section
                    if showDemoAccounts && !demoAccounts.isEmpty {
                        VStack(spacing: 12) {
                            HStack {
                                Rectangle()
                                    .fill(Color.rbTextTertiary.opacity(0.3))
                                    .frame(height: 1)
                                Text("QUICK LOGIN")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Color.rbTextTertiary)
                                    .tracking(1)
                                Rectangle()
                                    .fill(Color.rbTextTertiary.opacity(0.3))
                                    .frame(height: 1)
                            }
                            .padding(.horizontal, 24)

                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                                ForEach(demoAccounts) { account in
                                    Button {
                                        loginWith(email: account.email, password: account.password)
                                    } label: {
                                        VStack(spacing: 2) {
                                            Text(account.label)
                                                .font(.caption.weight(.semibold))
                                            if let tier = account.tier {
                                                Text(tier)
                                                    .font(.system(size: 9).weight(.medium))
                                                    .opacity(0.7)
                                            }
                                        }
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background(account.color.opacity(0.15))
                                        .foregroundStyle(account.color)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10)
                                                .strokeBorder(account.color.opacity(0.3), lineWidth: 1)
                                        )
                                    }
                                    .disabled(viewModel.isSubmitting)
                                }
                            }
                            .padding(.horizontal, 24)
                        }
                    }

                    Spacer(minLength: 40)
                }
            }
        }
        .navigationTitle("Log In")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            viewModel.errorMessage = nil
            Task { await loadDemoConfig() }
        }
    }

    private func loginWith(email: String, password: String) {
        self.email = email
        self.password = password
        viewModel.email = email
        viewModel.password = password
        Task { await viewModel.login() }
    }

    private func loadDemoConfig() async {
        do {
            let config: AppConfig = try await APIClient.shared.request(.appConfig)
            if config.demoMode {
                let password = config.demoPassword ?? "test1234"
                demoAccounts = config.demoAccounts.map { acc in
                    DemoAccount(
                        label: acc.label,
                        email: acc.email,
                        password: password,
                        role: acc.role,
                        tier: acc.tier,
                        color: Self.colorForRole(acc.role)
                    )
                }
                withAnimation { showDemoAccounts = true }
            }
        } catch {
            // Not in demo mode or endpoint unavailable — fine
        }
    }

    private static func colorForRole(_ role: String) -> Color {
        switch role {
        case "ADMIN": return .orange
        case "ARTIST": return .purple
        case "LABEL": return .blue
        case "STATION": return .green
        default: return .gray
        }
    }
}

// MARK: - Models

private struct AppConfig: Decodable, Sendable {
    let demoMode: Bool
    let demoAccounts: [DemoAccountConfig]
    let demoPassword: String?
}

private struct DemoAccountConfig: Decodable, Sendable {
    let label: String
    let email: String
    let role: String
    let tier: String?
}

private struct DemoAccount: Identifiable {
    let id = UUID()
    let label: String
    let email: String
    let password: String
    let role: String
    let tier: String?
    let color: Color
}

/// Lightweight text field styling — single background, no overlay/clipShape stack.
private struct AuthFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .foregroundStyle(Color.rbTextPrimary)
            .background(Color.rbSurface, in: RoundedRectangle(cornerRadius: 10))
    }
}

#Preview {
    NavigationStack {
        LoginView()
            .environment(AuthViewModel())
    }
}
