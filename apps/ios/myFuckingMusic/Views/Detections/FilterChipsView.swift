import SwiftUI

/// Horizontal scrolling filter chips for date range and station selection.
/// Binds to DetectionsViewModel filter state.
struct FilterChipsView: View {
    @Binding var startDate: Date?
    @Binding var endDate: Date?
    @Binding var selectedStationId: Int?
    let stations: [Station]
    let onFilterChange: () async -> Void

    @State private var showDatePicker = false
    @State private var showStationPicker = false

    // Local state for date picker sheet
    @State private var tempStartDate = Date()
    @State private var tempEndDate = Date()

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Date Range chip
                dateRangeChip

                // Station chip
                stationChip
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color.rbBackground)
        .sheet(isPresented: $showDatePicker) {
            datePickerSheet
        }
        .sheet(isPresented: $showStationPicker) {
            stationPickerSheet
        }
    }

    // MARK: - Date Range Chip

    private var dateRangeChip: some View {
        Button {
            if let start = startDate {
                tempStartDate = start
            }
            if let end = endDate {
                tempEndDate = end
            }
            showDatePicker = true
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "calendar")
                    .font(.caption)

                if let start = startDate, let end = endDate {
                    Text("\(DateFormatters.dateOnly(start)) - \(DateFormatters.dateOnly(end))")
                        .font(.caption)
                } else {
                    Text("Date Range")
                        .font(.caption)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(startDate != nil ? Color.rbAccent.opacity(0.2) : Color.rbSurface)
            .foregroundStyle(startDate != nil ? Color.rbAccent : Color.rbTextSecondary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(startDate != nil ? Color.rbAccent : Color.rbSurfaceLight, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Station Chip

    private var stationChip: some View {
        Button {
            showStationPicker = true
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.caption)

                if let stationId = selectedStationId,
                   let station = stations.first(where: { $0.id == stationId }) {
                    Text(station.name)
                        .font(.caption)
                        .lineLimit(1)
                } else {
                    Text("Station")
                        .font(.caption)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(selectedStationId != nil ? Color.rbAccent.opacity(0.2) : Color.rbSurface)
            .foregroundStyle(selectedStationId != nil ? Color.rbAccent : Color.rbTextSecondary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(selectedStationId != nil ? Color.rbAccent : Color.rbSurfaceLight, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Date Picker Sheet

    private var datePickerSheet: some View {
        NavigationStack {
            Form {
                Section("Start Date") {
                    DatePicker(
                        "From",
                        selection: $tempStartDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                }

                Section("End Date") {
                    DatePicker(
                        "To",
                        selection: $tempEndDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.rbBackground)
            .navigationTitle("Date Range")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Clear") {
                        startDate = nil
                        endDate = nil
                        showDatePicker = false
                        Task {
                            await onFilterChange()
                        }
                    }
                    .foregroundStyle(Color.rbTextSecondary)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        startDate = tempStartDate
                        endDate = tempEndDate
                        showDatePicker = false
                        Task {
                            await onFilterChange()
                        }
                    }
                    .foregroundStyle(Color.rbAccent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.large])
    }

    // MARK: - Station Picker Sheet

    private var stationPickerSheet: some View {
        NavigationStack {
            List {
                Button {
                    selectedStationId = nil
                    showStationPicker = false
                    Task {
                        await onFilterChange()
                    }
                } label: {
                    HStack {
                        Text("All Stations")
                            .foregroundStyle(Color.rbTextPrimary)
                        Spacer()
                        if selectedStationId == nil {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Color.rbAccent)
                        }
                    }
                }

                ForEach(stations) { station in
                    Button {
                        selectedStationId = station.id
                        showStationPicker = false
                        Task {
                            await onFilterChange()
                        }
                    } label: {
                        HStack {
                            Text(station.name)
                                .foregroundStyle(Color.rbTextPrimary)
                            Spacer()
                            if selectedStationId == station.id {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.rbAccent)
                            }
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.rbBackground)
            .navigationTitle("Select Station")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showStationPicker = false
                    }
                    .foregroundStyle(Color.rbTextSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.medium, .large])
    }
}
