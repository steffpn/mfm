import SwiftUI

/// Screen for entering an invite code in XXXX-XXXX-XXXX format.
/// Validates format before allowing navigation to registration.
struct InviteCodeView: View {
    @Environment(AuthViewModel.self) private var viewModel

    var body: some View {
        @Bindable var viewModel = viewModel

        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                // Header
                VStack(spacing: 8) {
                    Image(systemName: "ticket")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.rbAccent)

                    Text("Enter Invite Code")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.rbTextPrimary)

                    Text("Enter the code you received to create your account")
                        .font(.subheadline)
                        .foregroundStyle(Color.rbTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                // Code input
                TextField("XXXX-XXXX-XXXX", text: $viewModel.inviteCode)
                    .padding(14)
                    .background(Color.rbSurface)
                    .foregroundStyle(Color.rbTextPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.rbSurfaceLight, lineWidth: 1)
                    )
                    .font(.title3.monospaced())
                    .multilineTextAlignment(.center)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 48)
                    .onChange(of: viewModel.inviteCode) { _, newValue in
                        viewModel.inviteCode = viewModel.formattedInviteCode
                    }

                // Error message
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(Color.rbError)
                }

                Spacer()

                // Continue button
                NavigationLink {
                    RegisterView()
                } label: {
                    Text("Continue")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(viewModel.isInviteCodeValid ? Color.rbAccent : Color.rbSurfaceLight)
                        .foregroundStyle(viewModel.isInviteCodeValid ? .white : Color.rbTextTertiary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!viewModel.isInviteCodeValid)
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
            }
        }
        .navigationTitle("Invite Code")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }
}

#Preview {
    NavigationStack {
        InviteCodeView()
            .environment(AuthViewModel())
    }
}
