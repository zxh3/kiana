# Kiana Desktop

Kiana Desktop is a small native macOS menu-bar app that renders
<https://kiana.me> behind desktop icons on the built-in Mac display. If the
built-in display is unavailable, such as in clamshell mode or on a desktop Mac,
the app falls back to the current primary display.
Photos and videos use a full-bleed, aspect-fill presentation in this app, so
their edges may be cropped to cover the entire display like a native wallpaper.

## Requirements

- macOS 13 or newer
- Xcode 14 or newer

## Run locally

Open `KianaDesktop.xcodeproj` in Xcode, select the **KianaDesktop** scheme, and
press Run. The app appears in the menu bar rather than the Dock.

The wallpaper is click-through by default so Finder and desktop icons continue
to work normally. Use **Allow Website Interaction** in the menu-bar menu when
you want to interact with the page. The preference is remembered between
launches.

Use **Launch at Login** to register the app with macOS. If macOS requires manual
approval, the menu offers a shortcut to the Login Items settings page.

## Build from the command line

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild \
  -project apps/kiana-desktop/KianaDesktop.xcodeproj \
  -scheme KianaDesktop \
  -configuration Debug \
  -derivedDataPath /tmp/kiana-desktop-derived-data \
  build
```

The app sandbox is enabled with outgoing network access so `WKWebView` can load
the production website.
