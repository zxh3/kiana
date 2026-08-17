import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String, _ code: Int32) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(code)
}

let arguments = CommandLine.arguments
guard arguments.count == 4, let maxPixelSize = Int(arguments[3]) else {
    fail("usage: image-normalizer SOURCE DESTINATION MAX_PIXEL_SIZE", 64)
}

let sourceURL = URL(fileURLWithPath: arguments[1]) as CFURL
let destinationURL = URL(fileURLWithPath: arguments[2]) as CFURL

guard let source = CGImageSourceCreateWithURL(sourceURL, nil) else {
    fail("cannot open source image: \(arguments[1])", 65)
}

let options = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
    kCGImageSourceShouldCacheImmediately: true,
] as CFDictionary

guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else {
    fail("cannot decode source image: \(arguments[1])", 66)
}

guard let destination = CGImageDestinationCreateWithURL(
    destinationURL,
    UTType.png.identifier as CFString,
    1,
    nil
) else {
    fail("cannot create destination image: \(arguments[2])", 73)
}

CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
    fail("cannot write destination image: \(arguments[2])", 74)
}
