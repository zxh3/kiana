import Combine
import ServiceManagement

@MainActor
final class LoginItemController: ObservableObject {
    static let shared = LoginItemController()

    @Published private(set) var isEnabled = false
    @Published private(set) var requiresApproval = false
    @Published private(set) var message: String?

    private init() {
        refresh()
    }

    func refresh() {
        switch SMAppService.mainApp.status {
        case .enabled:
            isEnabled = true
            requiresApproval = false
            message = nil
        case .requiresApproval:
            isEnabled = false
            requiresApproval = true
            message = "Allow Kiana Desktop under Login Items to finish setup."
        case .notFound:
            isEnabled = false
            requiresApproval = false
            message = "Launch at login is unavailable for this build."
        case .notRegistered:
            isEnabled = false
            requiresApproval = false
            message = nil
        @unknown default:
            isEnabled = false
            requiresApproval = false
            message = "Launch-at-login status is unavailable."
        }
    }

    func setEnabled(_ enabled: Bool) {
        message = nil

        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
        } catch {
            message = error.localizedDescription
        }

        refresh()
    }

    func openSystemSettings() {
        SMAppService.openSystemSettingsLoginItems()
    }
}
