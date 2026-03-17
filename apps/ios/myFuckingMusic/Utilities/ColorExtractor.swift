import SwiftUI
import UIKit

/// Extracts dominant colors from a UIImage by sampling pixels.
/// Used to create dynamic gradient backgrounds from album artwork.
struct ColorExtractor {

    /// Extract the top N dominant colors from an image.
    /// Uses a simple pixel sampling + clustering approach.
    static func extractColors(from image: UIImage, count: Int = 3) -> [Color] {
        guard let cgImage = image.cgImage else {
            return [.rbSurface, .rbBackground, .rbSurfaceLight]
        }

        let width = 50  // Downsample for performance
        let height = 50
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel * width
        let bitsPerComponent = 8

        var pixelData = [UInt8](repeating: 0, count: width * height * bytesPerPixel)

        guard let context = CGContext(
            data: &pixelData,
            width: width,
            height: height,
            bitsPerComponent: bitsPerComponent,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return [.rbSurface, .rbBackground, .rbSurfaceLight]
        }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        // Sample pixels and collect colors with enough saturation and brightness
        var colorBuckets: [(r: Double, g: Double, b: Double, count: Int)] = []

        for y in stride(from: 0, to: height, by: 2) {
            for x in stride(from: 0, to: width, by: 2) {
                let offset = (y * width + x) * bytesPerPixel
                let r = Double(pixelData[offset]) / 255.0
                let g = Double(pixelData[offset + 1]) / 255.0
                let b = Double(pixelData[offset + 2]) / 255.0

                // Skip very dark, very light, and desaturated pixels
                let maxC = max(r, g, b)
                let minC = min(r, g, b)
                let saturation = maxC > 0 ? (maxC - minC) / maxC : 0
                let brightness = maxC

                if saturation < 0.15 || brightness < 0.1 || brightness > 0.95 {
                    continue
                }

                // Try to merge with existing bucket (simple clustering)
                var merged = false
                for i in colorBuckets.indices {
                    let dr = abs(colorBuckets[i].r - r)
                    let dg = abs(colorBuckets[i].g - g)
                    let db = abs(colorBuckets[i].b - b)
                    if dr + dg + db < 0.3 {
                        let c = colorBuckets[i].count
                        colorBuckets[i].r = (colorBuckets[i].r * Double(c) + r) / Double(c + 1)
                        colorBuckets[i].g = (colorBuckets[i].g * Double(c) + g) / Double(c + 1)
                        colorBuckets[i].b = (colorBuckets[i].b * Double(c) + b) / Double(c + 1)
                        colorBuckets[i].count += 1
                        merged = true
                        break
                    }
                }

                if !merged {
                    colorBuckets.append((r: r, g: g, b: b, count: 1))
                }
            }
        }

        // Sort by frequency, take top N
        let sorted = colorBuckets.sorted { $0.count > $1.count }
        let topColors = sorted.prefix(count).map { bucket in
            Color(red: bucket.r, green: bucket.g, blue: bucket.b)
        }

        if topColors.isEmpty {
            return [.rbAccent, .rbSurface, .rbBackground]
        }

        // Ensure we have enough colors
        var result = Array(topColors)
        while result.count < count {
            result.append(.rbBackground)
        }

        return result
    }

    /// Make a color more vibrant by increasing saturation
    static func vibrant(_ color: Color) -> Color {
        let uiColor = UIColor(color)
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return Color(hue: Double(h), saturation: min(Double(s) * 1.4, 1.0), brightness: min(Double(b) * 1.1, 1.0))
    }
}
