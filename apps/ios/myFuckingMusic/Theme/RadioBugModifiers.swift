import SwiftUI

// Card style modifier
struct RBCardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(Color.rbSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// Glow button style
struct RBAccentButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.black)
            .padding(.horizontal, 32)
            .padding(.vertical, 14)
            .background(
                LinearGradient.rbAccentGradient
                    .opacity(configuration.isPressed ? 0.8 : 1)
            )
            .clipShape(Capsule())
    }
}

// Secondary button
struct RBSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Color.rbAccent)
            .padding(.horizontal, 32)
            .padding(.vertical, 14)
            .background(Color.rbAccent.opacity(0.15))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.rbAccent.opacity(0.3), lineWidth: 1))
    }
}

extension View {
    func rbCard() -> some View {
        modifier(RBCardStyle())
    }
}
