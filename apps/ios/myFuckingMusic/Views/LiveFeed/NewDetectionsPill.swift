import SwiftUI

/// Twitter/X-style "New detections" overlay pill.
/// Blue capsule with arrow-up icon and count text. Appears when user is scrolled down
/// and new detections arrive. Tapping scrolls to top and dismisses the pill.
struct NewDetectionsPill: View {
    let count: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                Image(systemName: "arrow.up")
                    .font(.caption.bold())
                Text(count == 1 ? "1 new detection" : "\(count) new detections")
                    .font(.caption.bold())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.blue)
            .foregroundStyle(.white)
            .clipShape(Capsule())
            .shadow(radius: 4)
        }
    }
}
