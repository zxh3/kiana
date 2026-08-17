import AppKit
import SwiftUI

@main
struct KianaDesktopApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @ObservedObject private var wallpaper = WallpaperController.shared
    @ObservedObject private var loginItem = LoginItemController.shared

    var body: some Scene {
        MenuBarExtra("Kiana Desktop", systemImage: "photo.on.rectangle.angled") {
            Button("Reload Kiana") {
                wallpaper.reload()
            }
            .keyboardShortcut("r")

            Toggle("Allow Website Interaction", isOn: $wallpaper.isInteractive)

            Divider()

            Toggle(
                "Launch at Login",
                isOn: Binding(
                    get: { loginItem.isEnabled },
                    set: { loginItem.setEnabled($0) }
                )
            )

            if loginItem.requiresApproval {
                Button("Open Login Items Settings…") {
                    loginItem.openSystemSettings()
                }
            }

            if let message = loginItem.message {
                Text(message)
            }

            Divider()

            Button("Open kiana.me in Browser") {
                NSWorkspace.shared.open(WallpaperController.pageURL)
            }

            Button("Quit Kiana Desktop") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q")
        }
        .menuBarExtraStyle(.menu)
    }
}
