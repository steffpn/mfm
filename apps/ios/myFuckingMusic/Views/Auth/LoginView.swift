import SwiftUI

/// Login form: email and password.
/// On success, AuthManager.isAuthenticated triggers navigation to MainTabView.
struct LoginView: View {
    @Environment(AuthViewModel.self) private var viewModel
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "person.circle")
                            .font(.system(size: 48))
                            .foregroundStyle(Color.rbAccent)

                        Text("Welcome Back")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundStyle(Color.rbTextPrimary)

                        Text("Log in to your account")
                            .font(.subheadline)
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                    .padding(.top, 48)

                    // Form fields
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Email")
                                .font(.caption)
                                .foregroundStyle(Color.rbTextSecondary)
                            TextField("", text: $email, prompt: Text("email@example.com").foregroundStyle(Color.rbTextTertiary.opacity(0.6)))
                                .padding(12)
                                .background(Color.rbSurface)
                                .foregroundStyle(Color.rbTextPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.rbSurfaceLight, lineWidth: 1)
                                )
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Password")
                                .font(.caption)
                                .foregroundStyle(Color.rbTextSecondary)
                            SecureField("", text: $password, prompt: Text("Enter password").foregroundStyle(Color.rbTextTertiary.opacity(0.6)))
                                .padding(12)
                                .background(Color.rbSurface)
                                .foregroundStyle(Color.rbTextPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.rbSurfaceLight, lineWidth: 1)
                                )
                                .textContentType(.password)
                        }
                    }
                    .padding(.horizontal, 24)

                    // Error message
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(Color.rbError)
                            .padding(.horizontal, 24)
                    }

                    // Login button
                    Button {
                        viewModel.email = email
                        viewModel.password = password
                        Task {
                            await viewModel.login()
                        }
                    } label: {
                        Group {
                            if viewModel.isSubmitting {
                                ProgressView()
                                    .tint(.white)
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

                    Spacer()
                }
            }
        }
        .navigationTitle("Log In")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            viewModel.errorMessage = nil
        }
    }
}

#Preview {
    NavigationStack {
        LoginView()
            .environment(AuthViewModel())
    }
}
