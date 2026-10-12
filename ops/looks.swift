// Looks at screenshots, so a picture of a black, empty or repeated screen is never taken for an app.
//   swift ops/looks.swift one <picture>           prints  black=<0..1> colours=<count>
//   swift ops/looks.swift same <picture> <other>  prints  differs=<0..1>
// `black` is the share of the screen that is pure black (a phone still starting up is all black);
// `colours` is how many different colours it holds, coarsely counted (an empty screen has a few);
// `differs` is the share of the screen that is not the same in the two pictures.
import CoreGraphics
import Foundation
import ImageIO

/// Every sixth pixel of the picture, as bytes: red, green, blue.
func sample(_ path: String) -> [[UInt8]]? {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
    let width = image.width, height = image.height
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    guard let ctx = CGContext(data: &bytes, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                              space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    var pixels: [[UInt8]] = []
    for y in stride(from: 0, to: height, by: 6) {
        for x in stride(from: 0, to: width, by: 6) {
            let i = (y * width + x) * 4
            pixels.append([bytes[i], bytes[i + 1], bytes[i + 2]])
        }
    }
    return pixels
}

func fail(_ words: String) -> Never {
    FileHandle.standardError.write(Data("error: \(words)\n".utf8))
    exit(1)
}

let args = CommandLine.arguments
if args.count == 3, args[1] == "one" {
    guard let pixels = sample(args[2]) else { fail("the picture could not be read") }
    let black = pixels.filter { $0[0] < 8 && $0[1] < 8 && $0[2] < 8 }.count
    let colours = Set(pixels.map { (Int($0[0]) >> 4) << 8 | (Int($0[1]) >> 4) << 4 | Int($0[2]) >> 4 }).count
    print(String(format: "black=%.3f colours=%d", Double(black) / Double(pixels.count), colours))
} else if args.count == 4, args[1] == "same" {
    guard let a = sample(args[2]), let b = sample(args[3]), a.count == b.count else { fail("the pictures could not be compared") }
    let far = zip(a, b).filter { abs(Int($0[0]) - Int($1[0])) + abs(Int($0[1]) - Int($1[1])) + abs(Int($0[2]) - Int($1[2])) > 40 }.count
    print(String(format: "differs=%.3f", Double(far) / Double(a.count)))
} else {
    fail("use: looks.swift one <picture>, or looks.swift same <picture> <other>")
}
