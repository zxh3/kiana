import AppKit
import Combine
import CoreGraphics
import WebKit

@MainActor
final class WallpaperController: NSObject, ObservableObject, WKNavigationDelegate {
    static let shared = WallpaperController()
    static let pageURL = URL(string: "https://kiana.me")!

    @Published var isInteractive: Bool {
        didSet {
            UserDefaults.standard.set(isInteractive, forKey: Self.interactivePreferenceKey)
            applyInteractionPreference()
        }
    }

    private static let interactivePreferenceKey = "allowsWebsiteInteraction"
    private static let fullBleedScript = """
        (() => {
          try {
            window.localStorage.setItem("kiana.frame", "fill");
          } catch {}

          const style = document.createElement("style");
          style.id = "kiana-desktop-full-bleed";
          style.textContent = `
            html, body, #root, main {
              width: 100vw !important;
              min-width: 100vw !important;
              height: 100vh !important;
              min-height: 100vh !important;
              margin: 0 !important;
              overflow: hidden !important;
            }

            main img,
            main video {
              width: 100vw !important;
              max-width: none !important;
              height: 100vh !important;
              max-height: none !important;
              object-fit: cover !important;
              box-shadow: none !important;
            }
          `;
          (document.head ?? document.documentElement).appendChild(style);
        })();
        """

    private var presentations: [WallpaperPresentation] = []
    private var retryTasks: [ObjectIdentifier: DispatchWorkItem] = [:]
    private var hasStarted = false

    private override init() {
        isInteractive = UserDefaults.standard.bool(forKey: Self.interactivePreferenceKey)
        super.init()
    }

    func start() {
        guard !hasStarted else { return }
        hasStarted = true

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenParametersChanged(_:)),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )

        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(workspaceDidWake(_:)),
            name: NSWorkspace.didWakeNotification,
            object: nil
        )

        rebuildWindows()
    }

    func stop() {
        guard hasStarted else { return }
        hasStarted = false

        NotificationCenter.default.removeObserver(self)
        NSWorkspace.shared.notificationCenter.removeObserver(self)
        closeWindows()
    }

    func reload() {
        for presentation in presentations {
            loadPage(in: presentation.webView, ignoringCache: true)
        }
    }

    private func rebuildWindows() {
        closeWindows()

        guard let screen = Self.preferredScreen else { return }
        presentations = [makePresentation(for: screen)]
    }

    private func closeWindows() {
        retryTasks.values.forEach { $0.cancel() }
        retryTasks.removeAll()

        for presentation in presentations {
            presentation.webView.navigationDelegate = nil
            presentation.window.orderOut(nil)
            presentation.window.close()
        }
        presentations.removeAll()
    }

    private func makePresentation(for screen: NSScreen) -> WallpaperPresentation {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.fullBleedScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        let webView = WKWebView(
            frame: NSRect(origin: .zero, size: screen.frame.size),
            configuration: configuration
        )
        webView.autoresizingMask = [.width, .height]
        webView.allowsMagnification = false
        webView.navigationDelegate = self

        let window = WallpaperWindow(
            contentRect: screen.frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false,
            screen: screen
        )

        window.contentView = webView
        window.setFrame(screen.frame, display: true)
        window.backgroundColor = .black
        window.isOpaque = true
        window.hasShadow = false
        window.isReleasedWhenClosed = false
        window.isExcludedFromWindowsMenu = true
        window.level = Self.wallpaperWindowLevel
        window.collectionBehavior = [
            .canJoinAllSpaces,
            .stationary,
            .ignoresCycle,
            .fullScreenAuxiliary,
        ]
        window.allowsInteraction = isInteractive
        window.ignoresMouseEvents = !isInteractive
        window.orderFrontRegardless()

        loadPage(in: webView)
        return WallpaperPresentation(window: window, webView: webView)
    }

    private func loadPage(in webView: WKWebView, ignoringCache: Bool = false) {
        cancelRetry(for: webView)

        let cachePolicy: URLRequest.CachePolicy = ignoringCache
            ? .reloadIgnoringLocalCacheData
            : .useProtocolCachePolicy
        webView.load(URLRequest(url: Self.pageURL, cachePolicy: cachePolicy))
    }

    private func scheduleRetry(for webView: WKWebView) {
        let identifier = ObjectIdentifier(webView)
        guard retryTasks[identifier] == nil else { return }

        let task = DispatchWorkItem { [weak self, weak webView] in
            Task { @MainActor in
                guard let self, let webView else { return }
                self.retryTasks[identifier] = nil
                self.loadPage(in: webView)
            }
        }
        retryTasks[identifier] = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: task)
    }

    private func cancelRetry(for webView: WKWebView) {
        let identifier = ObjectIdentifier(webView)
        retryTasks.removeValue(forKey: identifier)?.cancel()
    }

    private func applyInteractionPreference() {
        for presentation in presentations {
            presentation.window.allowsInteraction = isInteractive
            presentation.window.ignoresMouseEvents = !isInteractive

            if !isInteractive, presentation.window.isKeyWindow {
                presentation.window.resignKey()
            }
        }
    }

    @objc private func screenParametersChanged(_ notification: Notification) {
        rebuildWindows()
    }

    @objc private func workspaceDidWake(_ notification: Notification) {
        for presentation in presentations {
            if presentation.webView.url == nil {
                loadPage(in: presentation.webView)
            } else {
                presentation.webView.reload()
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        cancelRetry(for: webView)
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: any Error
    ) {
        scheduleRetry(for: webView)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: any Error
    ) {
        scheduleRetry(for: webView)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadPage(in: webView)
    }

    private static var wallpaperWindowLevel: NSWindow.Level {
        let desktopLevel = Int(CGWindowLevelForKey(.desktopWindow))
        let desktopIconLevel = Int(CGWindowLevelForKey(.desktopIconWindow))

        guard desktopIconLevel > desktopLevel else {
            return NSWindow.Level(rawValue: desktopLevel)
        }

        return NSWindow.Level(rawValue: desktopLevel + max(1, (desktopIconLevel - desktopLevel) / 2))
    }

    private static var preferredScreen: NSScreen? {
        let screens = NSScreen.screens
        return screens.first(where: isBuiltInDisplay) ?? screens.first
    }

    private static func isBuiltInDisplay(_ screen: NSScreen) -> Bool {
        let screenNumberKey = NSDeviceDescriptionKey("NSScreenNumber")
        guard let screenNumber = screen.deviceDescription[screenNumberKey] as? NSNumber else {
            return false
        }

        return CGDisplayIsBuiltin(CGDirectDisplayID(screenNumber.uint32Value)) != 0
    }
}

private struct WallpaperPresentation {
    let window: WallpaperWindow
    let webView: WKWebView
}

private final class WallpaperWindow: NSWindow {
    var allowsInteraction = false

    override var canBecomeKey: Bool {
        allowsInteraction
    }

    override var canBecomeMain: Bool {
        false
    }
}
