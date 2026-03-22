import SwiftUI

/// Subscription management screen.
/// Shows current plan details for premium users or upgrade CTA for free users.
struct SubscriptionView: View {
    @State private var viewModel = SubscriptionViewModel()
    @Environment(\.openURL) private var openURL

    var body: some View {
        List {
            if viewModel.isLoading {
                Section {
                    HStack {
                        Spacer()
                        ProgressView()
                            .tint(Color.rbAccent)
                        Spacer()
                    }
                    .listRowBackground(Color.rbSurface)
                }
            } else if viewModel.isFreeTier {
                // Free tier - upgrade CTA
                freeUserSection
            } else {
                // Premium - show plan details
                premiumUserSection
            }

            // Feature list
            if let features = viewModel.subscriptionInfo?.features, !features.isEmpty {
                Section {
                    ForEach(features, id: \.self) { feature in
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Color.rbAccent)
                                .font(.subheadline)
                            Text(feature)
                                .foregroundStyle(Color.rbTextPrimary)
                                .font(.subheadline)
                        }
                        .listRowBackground(Color.rbSurface)
                    }
                } header: {
                    Text("What's Included")
                        .foregroundStyle(Color.rbTextSecondary)
                }
            }

            if let error = viewModel.error {
                Section {
                    Text(error)
                        .foregroundStyle(Color.rbError)
                        .font(.caption)
                        .listRowBackground(Color.rbSurface)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.rbBackground)
        .navigationTitle("Subscription")
        .toolbarColorScheme(.dark, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task {
            await viewModel.loadSubscription()
        }
        .onChange(of: viewModel.checkoutURL) { _, url in
            if let url { openURL(url) }
        }
        .onChange(of: viewModel.portalURL) { _, url in
            if let url { openURL(url) }
        }
    }

    // MARK: - Free User Section

    private var freeUserSection: some View {
        Section {
            VStack(spacing: 16) {
                Image(systemName: "star.circle.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Color.rbWarm)

                Text("Upgrade to Premium")
                    .foregroundStyle(Color.rbTextPrimary)
                    .font(.title2)
                    .fontWeight(.bold)

                Text("Unlock advanced analytics, daily reports, chart alerts, and more.")
                    .foregroundStyle(Color.rbTextSecondary)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)

                Button {
                    Task {
                        // Default to plan 1 (premium monthly)
                        await viewModel.createCheckout(planId: 1, billingInterval: "month")
                    }
                } label: {
                    Text("Upgrade Now")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.rbAccent)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 16)
            .listRowBackground(Color.rbSurface)
        } header: {
            Text("Current Plan: Free")
                .foregroundStyle(Color.rbTextSecondary)
        }
    }

    // MARK: - Premium User Section

    private var premiumUserSection: some View {
        Group {
            Section {
                if let plan = viewModel.subscriptionInfo?.plan {
                    HStack {
                        Text("Plan")
                            .foregroundStyle(Color.rbTextPrimary)
                        Spacer()
                        Text(plan.name)
                            .foregroundStyle(Color.rbAccent)
                            .fontWeight(.semibold)
                    }
                    .listRowBackground(Color.rbSurface)

                    HStack {
                        Text("Tier")
                            .foregroundStyle(Color.rbTextPrimary)
                        Spacer()
                        Text(plan.tier.capitalized)
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                    .listRowBackground(Color.rbSurface)
                }

                if let sub = viewModel.subscriptionInfo?.subscription {
                    HStack {
                        Text("Status")
                            .foregroundStyle(Color.rbTextPrimary)
                        Spacer()
                        Text(sub.status.capitalized)
                            .foregroundStyle(sub.status == "active" ? .green : Color.rbWarm)
                            .fontWeight(.medium)
                    }
                    .listRowBackground(Color.rbSurface)

                    HStack {
                        Text("Billing")
                            .foregroundStyle(Color.rbTextPrimary)
                        Spacer()
                        Text(sub.billingInterval.capitalized)
                            .foregroundStyle(Color.rbTextSecondary)
                    }
                    .listRowBackground(Color.rbSurface)

                    if let periodEnd = sub.currentPeriodEnd {
                        HStack {
                            Text("Renews")
                                .foregroundStyle(Color.rbTextPrimary)
                            Spacer()
                            Text(formattedDate(periodEnd))
                                .foregroundStyle(Color.rbTextSecondary)
                        }
                        .listRowBackground(Color.rbSurface)
                    }

                    if sub.cancelAtPeriodEnd {
                        HStack {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundStyle(Color.rbWarm)
                            Text("Cancels at end of period")
                                .foregroundStyle(Color.rbWarm)
                                .font(.subheadline)
                        }
                        .listRowBackground(Color.rbSurface)
                    }
                }
            } header: {
                Text("Your Plan")
                    .foregroundStyle(Color.rbTextSecondary)
            }

            // Manage billing
            Section {
                Button {
                    Task { await viewModel.createPortal() }
                } label: {
                    HStack {
                        Spacer()
                        Label("Manage Billing", systemImage: "creditcard")
                            .foregroundStyle(Color.rbAccent)
                            .fontWeight(.medium)
                        Spacer()
                    }
                }
                .listRowBackground(Color.rbSurface)
            }
        }
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        SubscriptionView()
    }
}
