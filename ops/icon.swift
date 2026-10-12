// Draws an app's icon from its icon.json: one plain shape on a two-colour field.
//   swift ops/icon.swift apps/<slug>/icon.json apps/<slug>/Assets.xcassets/AppIcon.appiconset/icon.png
// Shapes are drawn here from lines and curves. No system symbol, emoji or font is used: Apple does
// not allow its symbols in an app icon. The picture has no transparency, as the App Store requires.
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Spec: Decodable {
    let shape: String
    let top: String
    let bottom: String
    let ink: String?
}

func color(_ hex: String) -> CGColor {
    var value: UInt64 = 0
    Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&value)
    return CGColor(red: CGFloat((value >> 16) & 0xFF) / 255, green: CGFloat((value >> 8) & 0xFF) / 255, blue: CGFloat(value & 0xFF) / 255, alpha: 1)
}

let arguments = CommandLine.arguments
guard arguments.count == 3, let data = FileManager.default.contents(atPath: arguments[1]), let spec = try? JSONDecoder().decode(Spec.self, from: data) else {
    FileHandle.standardError.write(Data("error: icon.json could not be read\n".utf8))
    exit(1)
}

let size: CGFloat = 1024
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: Int(size), height: Int(size), bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let field = CGGradient(colorsSpace: space, colors: [color(spec.top), color(spec.bottom)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(field, start: CGPoint(x: 0, y: size), end: CGPoint(x: size, y: 0), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])

let ink = color(spec.ink ?? "#FFFFFF")
ctx.setFillColor(ink)
ctx.setStrokeColor(ink)
ctx.setLineCap(.round)
ctx.setLineJoin(.round)
ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 36, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.18))

let mid = size / 2
func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: y) }
func rounded(_ rect: CGRect, _ radius: CGFloat) { ctx.addPath(CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)) }
func polygon(_ points: [CGPoint]) {
    ctx.move(to: points[0])
    points.dropFirst().forEach { ctx.addLine(to: $0) }
    ctx.closePath()
}

switch spec.shape {
case "circle":
    ctx.fillEllipse(in: CGRect(x: mid - 250, y: mid - 250, width: 500, height: 500))
case "ring":
    ctx.setLineWidth(96)
    ctx.strokeEllipse(in: CGRect(x: mid - 230, y: mid - 230, width: 460, height: 460))
case "bars":
    for (i, height) in [260.0, 420.0, 560.0].enumerated() {
        rounded(CGRect(x: 262 + CGFloat(i) * 180, y: 232, width: 140, height: height), 44)
    }
    ctx.fillPath()
case "check":
    ctx.setLineWidth(110)
    ctx.move(to: point(290, 520)); ctx.addLine(to: point(450, 360)); ctx.addLine(to: point(740, 680))
    ctx.strokePath()
case "plus":
    rounded(CGRect(x: mid - 60, y: 252, width: 120, height: 520), 50)
    rounded(CGRect(x: 252, y: mid - 60, width: 520, height: 120), 50)
    ctx.fillPath()
case "drop":
    ctx.move(to: point(mid, 800))
    ctx.addCurve(to: point(mid + 210, 430), control1: point(mid + 60, 690), control2: point(mid + 210, 560))
    ctx.addArc(center: point(mid, 430), radius: 210, startAngle: 0, endAngle: .pi, clockwise: true)
    ctx.addCurve(to: point(mid, 800), control1: point(mid - 210, 560), control2: point(mid - 60, 690))
    ctx.fillPath()
case "bolt":
    polygon([point(580, 820), point(330, 480), point(490, 480), point(430, 204), point(700, 570), point(530, 570)])
    ctx.fillPath()
case "star":
    polygon((0..<10).map { i in
        let angle = CGFloat.pi / 2 + CGFloat(i) * .pi / 5
        let radius: CGFloat = i % 2 == 0 ? 300 : 128
        return point(mid + cos(angle) * radius, mid - 10 + sin(angle) * radius)
    })
    ctx.fillPath()
case "heart":
    ctx.move(to: point(mid, 260))
    ctx.addCurve(to: point(mid - 290, 600), control1: point(mid - 150, 370), control2: point(mid - 290, 470))
    ctx.addArc(center: point(mid - 145, 600), radius: 145, startAngle: .pi, endAngle: 0, clockwise: true)
    ctx.addArc(center: point(mid + 145, 600), radius: 145, startAngle: .pi, endAngle: 0, clockwise: true)
    ctx.addCurve(to: point(mid, 260), control1: point(mid + 290, 470), control2: point(mid + 150, 370))
    ctx.fillPath()
case "moon":
    let moon = CGMutablePath()
    moon.addEllipse(in: CGRect(x: mid - 260, y: mid - 260, width: 520, height: 520))
    moon.addEllipse(in: CGRect(x: mid - 90, y: mid - 130, width: 440, height: 440))
    ctx.addPath(moon)
    ctx.fillPath(using: .evenOdd)
case "pin":
    let pin = CGMutablePath()
    pin.move(to: point(mid, 210))
    pin.addCurve(to: point(mid - 210, 590), control1: point(mid - 70, 330), control2: point(mid - 210, 450))
    pin.addArc(center: point(mid, 590), radius: 210, startAngle: .pi, endAngle: 0, clockwise: true)
    pin.addCurve(to: point(mid, 210), control1: point(mid + 210, 450), control2: point(mid + 70, 330))
    pin.addEllipse(in: CGRect(x: mid - 80, y: 510, width: 160, height: 160))
    ctx.addPath(pin)
    ctx.fillPath(using: .evenOdd)
case "grid":
    for row in 0..<2 {
        for column in 0..<2 {
            rounded(CGRect(x: 262 + CGFloat(column) * 270, y: 262 + CGFloat(row) * 270, width: 230, height: 230), 56)
        }
    }
    ctx.fillPath()
case "wave":
    ctx.setLineWidth(70)
    for (i, y) in [360.0, 512.0, 664.0].enumerated() {
        let shift: CGFloat = i % 2 == 0 ? 60 : -60
        ctx.move(to: point(250, y))
        ctx.addCurve(to: point(774, y), control1: point(420, y + 130 + shift), control2: point(600, y - 130 - shift))
    }
    ctx.strokePath()
case "clock":
    ctx.setLineWidth(84)
    ctx.strokeEllipse(in: CGRect(x: mid - 250, y: mid - 250, width: 500, height: 500))
    ctx.setLineWidth(70)
    ctx.move(to: point(mid, mid + 150)); ctx.addLine(to: point(mid, mid)); ctx.addLine(to: point(mid + 110, mid - 70))
    ctx.strokePath()
case "flag":
    rounded(CGRect(x: 300, y: 220, width: 70, height: 600), 30)
    ctx.fillPath()
    polygon([point(370, 800), point(740, 700), point(370, 560)])
    ctx.fillPath()
default:
    FileHandle.standardError.write(Data("error: icon.json names a shape this script does not draw: \(spec.shape)\n".utf8))
    exit(1)
}

guard let image = ctx.makeImage(), let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: arguments[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(destination, image, nil)
if !CGImageDestinationFinalize(destination) { exit(1) }
