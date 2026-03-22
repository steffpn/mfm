import SwiftUI

/// Registration form: name, email, password, confirm password.
/// On success, AuthManager.isAuthenticated triggers navigation to MainTabView.
struct RegisterView: View {
    @Environment(AuthViewModel.self) private var viewModel
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 48))
                            .foregroundStyle(Color.rbAccent)

                        Text("Create Account")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundStyle(Color.rbTextPrimary)

                        Text("Fill in your details to get started")
                            .font(.subheadline)
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                    .padding(.top, 24)

                    // Form fields
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Name")
                                .font(.caption)
                                .foregroundStyle(Color.rbTextSecondary)
                            TextField("", text: $name, prompt: Text("Your name").foregroundStyle(Color.rbTextTertiary.opacity(0.6)))
                                .padding(12)
                                .background(Color.rbSurface)
                                .foregroundStyle(Color.rbTextPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.rbSurfaceLight, lineWidth: 1)
                                )
                                .textContentType(.name)
                                .textInputAutocapitalization(.words)
                        }

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
                            SecureField("", text: $password, prompt: Text("Minimum 8 characters").foregroundStyle(Color.rbTextTertiary.opacity(0.6)))
                                .padding(12)
                                .background(Color.rbSurface)
                                .foregroundStyle(Color.rbTextPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.rbSurfaceLight, lineWidth: 1)
                                )
                                .textContentType(.newPassword)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Confirm Password")
                                .font(.caption)
                                .foregroundStyle(Color.rbTextSecondary)
                            SecureField("", text: $confirmPassword, prompt: Text("Re-enter password").foregroundStyle(Color.rbTextTertiary.opacity(0.6)))
                                .padding(12)
                                .background(Color.rbSurface)
                                .foregroundStyle(Color.rbTextPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.rbSurfaceLight, lineWidth: 1)
                                )
                                .textContentType(.newPassword)
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

                    // Create Account button
                    Button {
                        viewModel.name = name
                        viewModel.email = email
                        viewModel.password = password
                        viewModel.confirmPassword = confirmPassword
                        Task {
                            await viewModel.register()
                        }
                    } label: {
                        Group {
                            if viewModel.isSubmitting {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Create Account")
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
                    .padding(.bottom, 48)
                }
            }
        }
        .navigationTitle("Register")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }
}

#Preview {
    NavigationStack {
        RegisterView()
            .environment(AuthViewModel())
    }
}
