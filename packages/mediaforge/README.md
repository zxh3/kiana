# Mediaforge

Mediaforge turns a directory of original photos, videos, and Live Photos into a
browser-ready media release. It leaves the source files unchanged and produces:

- 1280px and 2400px WebP images
- H.264/AAC MP4 videos with fast-start enabled
- WebP posters for standalone videos
- a `manifest.json` describing every processed asset

Mediaforge can use any compatible source directory. On macOS, it can also export
an Apple Photos album directly through osxphotos.

## Requirements

- macOS (image conversion currently uses `sips`)
- Python 3.11 or newer
- [`uv`](https://docs.astral.sh/uv/)
- `cwebp`, `ffmpeg`, and `ffprobe`

Install the system media tools with Homebrew:

```bash
brew install webp ffmpeg
```

From the repository root, install Mediaforge:

```bash
uv sync --package mediaforge
```

## Quick start with Apple Photos

Export an album into a source directory:

```bash
uv run mediaforge apple-photos export \
  originals/2026-08-16 \
  --album "Kiana"
```

This command:

1. downloads missing iCloud originals through PhotoKit;
2. exports originals, edited versions, and Live Photo videos using UUID names;
3. retains `.osxphotos_export.db` for incremental updates;
4. writes an export report and `mediaforge-metadata.json`.

Check the source, optionally build a small sample, then build and verify the
complete release:

```bash
uv run mediaforge doctor originals/2026-08-16

uv run mediaforge sample \
  originals/2026-08-16 \
  web/sample \
  --limit 20

caffeinate -i uv run mediaforge process \
  originals/2026-08-16 \
  web/releases/2026-08-16

uv run mediaforge verify \
  originals/2026-08-16 \
  web/releases/2026-08-16 \
  --deep
```

Run the same export and process commands when the album changes. Both operations
are incremental.

## Kiana release workflow

Kiana's private originals and browser-ready files use matching release folders:

```text
kiana-icloud/<release>/
kiana-web/releases/<release>/
```

From the repository root, set the release date and run the complete workflow:

```bash
RELEASE=2026-08-16
SOURCE="kiana-icloud/$RELEASE"
OUTPUT="kiana-web/releases/$RELEASE"

uv sync --package mediaforge
caffeinate -i uv run mediaforge apple-photos export "$SOURCE" --album "Kiana"

uv run mediaforge doctor "$SOURCE"
uv run mediaforge sample "$SOURCE" "kiana-web/sample"
caffeinate -i uv run mediaforge process "$SOURCE" "$OUTPUT"
uv run mediaforge verify "$SOURCE" "$OUTPUT" --deep
```

Export and processing are incremental, so rerun the same commands after the
album changes or to resume interrupted work.

After verification, mirror both releases to the configured `r2` remote and
check the uploads:

```bash
rclone copy "$SOURCE" "r2:kiana-icloud/$RELEASE" --exclude .osxphotos_export.db --progress
rclone copy "$OUTPUT" "r2:kiana-web/releases/$RELEASE" --progress

rclone check "$SOURCE" "r2:kiana-icloud/$RELEASE" --exclude .osxphotos_export.db --one-way --size-only
rclone check "$OUTPUT" "r2:kiana-web/releases/$RELEASE" --one-way --size-only
```

## Source format

Mediaforge groups related files by Apple Photos UUID. Supported filenames are:

```text
<UUID>.HEIC
<UUID>.JPG
<UUID>.JPEG
<UUID>.PNG
<UUID>.MOV
<UUID>.MP4
<UUID>_edited.<extension>
```

An image and video with the same UUID form a Live Photo when the metadata has
`"live_photo": true`. Mediaforge prefers `_edited` images when both edited and
original versions exist.

The default metadata path is:

```text
SOURCE/mediaforge-metadata.json
```

Use `--metadata PATH` on `doctor`, `sample`, `process`, or `verify` to supply a
different JSON file. The file must contain a JSON array whose items have at least
a `uuid` field. The Apple Photos adapter creates this file automatically.

## Commands

### `apple-photos export`

Incrementally export one Apple Photos album:

```bash
uv run mediaforge apple-photos export OUTPUT --album ALBUM [OPTIONS]
```

Options:

- `--album TEXT`: album name; required.
- `--library PATH`: Photos Library to use. The last-opened library is used by
  default.
- `--metadata FILE`: override the metadata output path.

This command is macOS-only.

### `doctor`

Check required media tools, the source directory, and the metadata file:

```bash
uv run mediaforge doctor SOURCE [--metadata FILE]
```

Run this before starting a long processing job.

### `sample`

Process a representative mix of photos, videos, and Live Photos:

```bash
uv run mediaforge sample SOURCE OUTPUT [--limit INTEGER] [--metadata FILE]
```

The default limit is 20. Use the sample to inspect image orientation, color,
video playback, and output quality before processing the full collection.

### `process`

Build or resume a complete browser-ready release:

```bash
uv run mediaforge process SOURCE OUTPUT [--metadata FILE]
```

Long runs can be kept awake on macOS with `caffeinate -i`. Existing non-empty
outputs are skipped, so rerunning the command resumes interrupted work.

If one or more assets fail, Mediaforge continues processing the remaining
assets, exits unsuccessfully, and writes:

- `manifest.partial.json` for the assets that succeeded;
- `errors.json` with one entry per failed asset.

After every asset succeeds, it writes `manifest.json` and removes stale partial
and error files.

### `verify`

Compare the completed manifest with the source and check every referenced file:

```bash
uv run mediaforge verify SOURCE OUTPUT [--metadata FILE] [--deep]
```

`--deep` additionally probes every video and verifies that it uses H.264. This
is slower but recommended before publishing a release.

## Output layout

```text
OUTPUT/
├── images/
│   ├── <UUID>-1280.webp
│   └── <UUID>-2400.webp
├── videos/
│   └── <UUID>.mp4
└── manifest.json
```

Each manifest asset contains its UUID, media type, capture date, responsive
image paths and dimensions, plus video path, dimensions, and duration when
applicable.

## Development

Run all repository checks from the workspace root:

```bash
uv run ruff format --check .
uv run ruff check .
uv run ty check packages
uv run pytest
```
