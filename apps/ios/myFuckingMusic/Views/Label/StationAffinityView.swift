import SwiftUI

/// Shows which stations play this label's music most.
/// Stations sorted by affinity percentage with progress bars.
struct StationAffinityView: View {
    @State private var viewModel = StationAffinityViewModel()

    var body: some View {
        ZStack {
            Color.rbBackground
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.affinityData.isEmpty {
                LoadingView()
            } else if let errorMessage = viewModel.error, viewModel.affinityData.isEmpty {
                ErrorView(message: errorMessage) {
                    Task { await viewModel.loadAffinity() }
                }
            } else if viewModel.affinityData.isEmpty {
                emptyStateView
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(viewModel.affinityData) { item in
                            affinityRow(item)

                            Divider()
                                .overlay(Color.rbSurfaceLight.opacity(0.5))
                                .padding(.leading, 68)
                        }
                    }
                    .padding(.vertical, 8)
                }
                .refreshable {
                    await viewModel.loadAffinity()
                }
            }
        }
        .navigationTitle("Station Affinity")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(Color.rbBackground, for: .navigationBar)
        .preferredColorScheme(.dark)
        .task {
            await viewModel.loadAffinity()
        }
    }

    // MARK: - Affinity Row

    private func affinityRow(_ item: StationAffinityItem) -> some View {
        HStack(spacing: 14) {
            // Station logo / placeholder
            stationLogo(item)

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.stationName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.rbTextPrimary)
                        .lineLimit(1)

                    Spacer()

                    Text(String(format: "%.1f%%", item.affinityPercent))
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color.rbAccent)
                }

                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.rbSurface)
                            .frame(height: 6)

                        RoundedRectangle(cornerRadius: 3)
                            .fill(
                                LinearGradient(
                                    colors: [.rbAccent, .rbWarm],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(
                                width: geometry.size.width * CGFloat(min(item.affinityPercent, 100.0) / 100.0),
                                height: 6
                            )
                    }
                }
                .frame(height: 6)

                Text("\(item.labelPlays) plays")
                    .font(.caption)
                    .foregroundStyle(Color.rbTextSecondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func stationLogo(_ item: StationAffinityItem) -> some View {
        Group {
            if let logoUrl = item.logoUrl, let url = URL(string: logoUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        stationPlaceholder
                    }
                }
            } else {
                stationPlaceholder
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var stationPlaceholder: some View {
        ZStack {
            Color.rbSurface
            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 16))
                .foregroundStyle(Color.rbTextTertiary)
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 48))
                .foregroundStyle(Color.rbTextTertiary)

            Text("No Station Data")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.rbTextPrimary)

            Text("Station affinity data will appear once your artists are detected on radio stations")
                .font(.subheadline)
                .foregroundStyle(Color.rbTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    NavigationStack {
        StationAffinityView()
    }
    .preferredColorScheme(.dark)
}
