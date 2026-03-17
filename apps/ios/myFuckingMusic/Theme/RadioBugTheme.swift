import SwiftUI

// RadioBug Dark Theme - inspired by Spotify, YouTube Music, SoundCloud
extension Color {
    // Backgrounds
    static let rbBackground = Color(hex: "0A0A0A")           // Near black
    static let rbSurface = Color(hex: "1A1A2E")              // Dark navy card bg
    static let rbSurfaceLight = Color(hex: "252540")          // Elevated surface
    static let rbSurfaceHighlight = Color(hex: "2D2D4A")     // Hover/selected state

    // Accent - radiowave teal/cyan
    static let rbAccent = Color(hex: "00D4AA")               // Primary accent (teal)
    static let rbAccentLight = Color(hex: "4DFFD4")          // Light accent
    static let rbAccentDark = Color(hex: "00A080")           // Dark accent for pressed states

    // Secondary accent - warm amber for highlights
    static let rbWarm = Color(hex: "FF6B35")                 // Orange/warm accent
    static let rbWarmLight = Color(hex: "FFA06B")            // Light warm

    // Text
    static let rbTextPrimary = Color(hex: "F0F0F0")          // Primary text
    static let rbTextSecondary = Color(hex: "A0A0B0")        // Secondary text
    static let rbTextTertiary = Color(hex: "6B6B80")         // Muted text

    // Status
    static let rbLive = Color(hex: "00FF88")                 // Live/connected green
    static let rbError = Color(hex: "FF4757")                // Error red
    static let rbWarning = Color(hex: "FFB347")              // Warning amber

    // Gradients
    static let rbGradientStart = Color(hex: "00D4AA")
    static let rbGradientEnd = Color(hex: "0066FF")

    // Hex initializer
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// Reusable gradient
extension LinearGradient {
    static let rbAccentGradient = LinearGradient(
        colors: [.rbGradientStart, .rbGradientEnd],
        startPoint: .leading,
        endPoint: .trailing
    )
}
