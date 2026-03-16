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
            .background(startDate != nil ? Color.accentColor.opacity(0.15) : Color(.systemGray6))
            .foregroundStyle(startDate != nil ? Color.accentColor : Color.primary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(startDate != nil ? Color.accentColor : Color(.systemGray4), lineWidth: 1)
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
            .background(selectedStationId != nil ? Color.accentColor.opacity(0.15) : Color(.systemGray6))
            .foregroundStyle(selectedStationId != nil ? Color.accentColor : Color.primary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(selectedStationId != nil ? Color.accentColor : Color(.systemGray4), lineWidth: 1)
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
            .navigationTitle("Date Range")
            .navigationBarTitleDisplayMode(.inline)
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
                }
            }
        }
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
                        Spacer()
                        if selectedStationId == nil {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Color.accentColor)
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
                            Spacer()
                            if selectedStationId == station.id {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Select Station")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showStationPicker = false
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
