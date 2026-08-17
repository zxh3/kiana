import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.accessory)
        WallpaperController.shared.start()
        LoginItemController.shared.refresh()
    }

    func applicationWillTerminate(_ notification: Notification) {
        WallpaperController.shared.stop()
    }
}
