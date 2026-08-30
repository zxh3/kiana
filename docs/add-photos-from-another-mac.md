# Add photos from another Mac

This runbook adds photos from a second Mac's Apple Photos library to Kiana. It
is written so that either a person or a fresh Codex task can carry out the work
without relying on context from the original development machine.

The production gallery reads:

```text
https://media.kiana.me/releases/current/manifest.json
```

The Cloudflare R2 buckets have different purposes:

```text
kiana-icloud/2026-08-16/       private originals and merged metadata
kiana-web/releases/<release>/  processed images, videos, and manifest
```

`kiana-icloud` must remain private. Only `kiana-web` is served by
`media.kiana.me`.

## Safety rules

Follow these rules throughout the workflow:

1. Use `rclone copy`, never `rclone sync`, `delete`, or `purge`. A second Mac may
   have only part of the library, so synchronization could delete media that
   exists only in R2.
2. Download the existing originals **and** the existing processed release
   before exporting or processing new photos.
3. Merge the old and new metadata. Replacing metadata with the second Mac's
   album metadata can make old Live Photos look like ordinary still photos.
4. Upload to a dated staging release and review it before changing `current`.
5. During promotion, copy images and videos first and `manifest.json` last. The
   manifest must never reference files that have not been uploaded yet.
6. Never commit photos, generated releases, R2 credentials, `.env.local`, or
   `.osxphotos_export.db`. They are intentionally ignored by Git.
7. Never paste an R2 secret into Codex, a Markdown file, a shell command, or the
   repository. Enter it only into the interactive `rclone config` prompt.

## Copy-paste prompt for Codex on the other Mac

After cloning the repository, start a Codex task from the repository root and
send it this prompt:

```text
Read docs/add-photos-from-another-mac.md completely and help me follow it.
Inspect the repository and current Git status first. Do not use rclone sync,
delete, or purge. Do not expose or store R2 credentials in the repository or
chat. Bootstrap both the existing private originals and the current public
release before exporting. Preserve and merge metadata exactly as documented.
Use a dated staging release, run all verification, and stop before promoting it
to releases/current so I can review the staging gallery. Do not commit or push
unless I explicitly ask.
```

Codex can run the local commands, inspect errors, and verify counts. R2 token
creation and the final staging review require the owner's participation.

## 1. Prepare Apple Photos

On the second Mac:

1. Open Photos and let it finish syncing the relevant originals from iCloud.
2. Create an album containing the photos to add. `Kiana Import` is a useful
   name. It may contain only the photos unique to this Mac; it does not need to
   duplicate the complete production album.
3. If Photos uses optimized storage, leave Photos open during export. Mediaforge
   asks PhotoKit to download missing originals.
4. When macOS asks, allow Terminal or Codex to access Photos. If access was
   previously denied, enable it in **System Settings > Privacy & Security >
   Photos**. Full Disk Access may also be needed for a non-default Photos
   library.

If more than one Photos library exists, note the path to the intended
`.photoslibrary`. The export command supports `--library PATH`.

## 2. Clone and prepare the repository

Install Homebrew first if it is not already available, then clone Kiana:

```bash
git clone git@github.com:zxh3/kiana.git
cd kiana
git pull --ff-only origin main
git status --short --branch
```

An HTTPS clone works too:

```bash
git clone https://github.com/zxh3/kiana.git
```

Install the command-line dependencies:

```bash
xcode-select --install
brew install node uv webp ffmpeg rclone jq
npm install
uv sync --all-packages
```

`xcode-select --install` may say the tools are already installed; that is fine.
Confirm the important tools are available:

```bash
node --version
uv --version
cwebp -version
ffmpeg -version
rclone version
jq --version
```

## 3. Configure access to R2

If this Mac already has a working `r2` rclone remote, skip to the verification
commands below.

Otherwise, create a narrowly scoped R2 API token in Cloudflare:

1. Open **Cloudflare Dashboard > Storage & databases > R2 > Overview > Manage
   API Tokens**.
2. Create an R2 token with **Object Read & Write** access.
3. Scope it only to `kiana-icloud` and `kiana-web` if the dashboard allows both
   buckets to be selected.
4. Copy the **Access Key ID**, **Secret Access Key**, account ID, and S3 endpoint.
   The secret is displayed only once. Store it in a password manager.

See Cloudflare's [R2 token documentation](https://developers.cloudflare.com/r2/api/tokens/)
and [rclone setup guide](https://developers.cloudflare.com/r2/examples/rclone/)
if the dashboard wording changes.

Run the interactive configurator:

```bash
rclone config
```

Create a remote named `r2` with these values:

```text
Storage type:       Amazon S3 Compliant Storage Providers
Provider:           Cloudflare R2
Use env auth:       false
Access key ID:      enter it only at the prompt
Secret access key: enter it only at the prompt
Region:             auto (or leave blank if prompted)
Endpoint:           https://<ACCOUNT_ID>.r2.cloudflarestorage.com
ACL:                leave blank
```

For a bucket-scoped token, enable `no_check_bucket = true` in the remote's
advanced configuration if rclone cannot perform account-level bucket checks.

Verify access directly against both buckets:

```bash
rclone lsf r2:kiana-icloud/2026-08-16 --max-depth 1 | head
rclone lsf r2:kiana-web/releases/current --max-depth 1
```

`rclone lsd r2:` may be denied by a bucket-scoped token even when both commands
above work. That does not prevent this workflow.

## 4. Set this run's variables

Run all remaining commands from the repository root. The existing private
source release is intentionally kept at `2026-08-16`; it is the cumulative
source library, not the date of this import.

Choose an album and a unique staging name:

```bash
SOURCE_RELEASE="2026-08-16"
STAGING_RELEASE="$(date +%F)-macbook"
ALBUM="Kiana Import"

SOURCE="kiana-icloud/$SOURCE_RELEASE"
OUTPUT="kiana-web/releases/$STAGING_RELEASE"
CURRENT_OUTPUT="kiana-web/releases/current-bootstrap"

mkdir -p "$SOURCE" "$OUTPUT" "$CURRENT_OUTPUT"
```

If that staging prefix has already been used for a different attempt, append a
suffix such as `-2` before continuing. Reusing the same prefix to resume the
same attempt is safe because the pipeline and `rclone copy` are incremental.

## 5. Bootstrap the complete existing collection

Download the private originals and the current processed release:

```bash
rclone copy "r2:kiana-icloud/$SOURCE_RELEASE" "$SOURCE" --progress
rclone copy "r2:kiana-web/releases/current" "$CURRENT_OUTPUT" --progress
```

Copy the current processed release into the new local staging output. This lets
Mediaforge skip thousands of already processed files and add only missing
outputs:

```bash
rclone copy "$CURRENT_OUTPUT" "$OUTPUT" --progress
```

Stop if either check fails:

```bash
test -s "$CURRENT_OUTPUT/manifest.json"
test -d "$SOURCE"
jq '.schemaVersion, (.assets | length), .revision' "$CURRENT_OUTPUT/manifest.json"
```

Record the starting count for comparison later:

```bash
BASE_COUNT="$(jq '.assets | length' "$CURRENT_OUTPUT/manifest.json")"
echo "Starting manifest assets: $BASE_COUNT"
```

Do not continue with an empty `SOURCE` or a missing current manifest. Processing
only the new Mac's files into an empty output would produce an incomplete
production release.

## 6. Preserve and merge media metadata

Apple Photos metadata tells Mediaforge whether a UUID is a photo, standalone
video, or Live Photo. The second Mac's import album contains metadata only for
that album, so it must be merged with the existing collection.

First reconstruct a minimal, reliable baseline from the production manifest:

```bash
jq '[.assets[] | {
  uuid: .id,
  date_original: .date,
  live_photo: (.type == "live_photo"),
  ismovie: (.type == "video")
}]' "$CURRENT_OUTPUT/manifest.json" \
  > "$SOURCE/mediaforge-metadata.manifest-baseline.json"
```

If the private source already contains richer metadata from an earlier import,
preserve it. Otherwise create an empty baseline:

```bash
if test -s "$SOURCE/mediaforge-metadata.json"; then
  cp "$SOURCE/mediaforge-metadata.json" \
    "$SOURCE/mediaforge-metadata.private-baseline.json"
else
  printf '[]\n' > "$SOURCE/mediaforge-metadata.private-baseline.json"
fi
```

Export the second Mac's album into the cumulative source directory, but write
its metadata to a separate file:

```bash
caffeinate -i uv run mediaforge apple-photos export "$SOURCE" \
  --album "$ALBUM" \
  --metadata "$SOURCE/mediaforge-metadata.new-mac.json"
```

For a non-default Photos library, add for example:

```text
--library "/Users/your-name/Pictures/Other Photos Library.photoslibrary"
```

The export is incremental and uses UUID filenames, so a matching UUID is not
duplicated. It also creates `.osxphotos_export.db`, which is local state for this
Mac and must not be uploaded or committed.

Merge metadata in this order:

1. the current public manifest supplies the minimum known production metadata;
2. existing private metadata adds richer fields from previous imports;
3. the new Mac's Apple Photos metadata wins for UUIDs it knows about.

```bash
jq -s '
  add
  | reduce .[] as $item
      ({};
        ($item.uuid | ascii_upcase) as $id
        | .[$id] = ((.[$id] // {}) + $item + {uuid: $id})
      )
  | to_entries
  | map(.value)
  | sort_by(.uuid)
' \
  "$SOURCE/mediaforge-metadata.manifest-baseline.json" \
  "$SOURCE/mediaforge-metadata.private-baseline.json" \
  "$SOURCE/mediaforge-metadata.new-mac.json" \
  > "$SOURCE/mediaforge-metadata.merged.json"

mv "$SOURCE/mediaforge-metadata.merged.json" \
  "$SOURCE/mediaforge-metadata.json"
```

Validate that the merged file is an array with unique UUIDs and at least as many
records as the old manifest:

```bash
jq 'length' "$SOURCE/mediaforge-metadata.json"
jq '[.[].uuid] | length == (unique | length)' \
  "$SOURCE/mediaforge-metadata.json"

MERGED_COUNT="$(jq 'length' "$SOURCE/mediaforge-metadata.json")"
test "$MERGED_COUNT" -ge "$BASE_COUNT"
```

The uniqueness command must print `true`, and the final `test` must exit
successfully.

## 7. Process and verify the cumulative release

Run the environment and source checks first:

```bash
uv run mediaforge doctor "$SOURCE"
```

Then process the complete collection. Because `OUTPUT` was bootstrapped from
the current release, non-empty existing outputs are skipped and only new or
missing files are encoded:

```bash
caffeinate -i uv run mediaforge process "$SOURCE" "$OUTPUT"
```

Mediaforge performs deep verification before atomically publishing
`manifest.json`. Run the explicit verifier as a final check:

```bash
uv run mediaforge verify "$SOURCE" "$OUTPUT" --deep
```

Compare counts and inspect the new revision:

```bash
NEW_COUNT="$(jq '.assets | length' "$OUTPUT/manifest.json")"
echo "Before: $BASE_COUNT"
echo "After:  $NEW_COUNT"
jq '.schemaVersion, .revision' "$OUTPUT/manifest.json"
test "$NEW_COUNT" -ge "$BASE_COUNT"
```

The exact increase may differ from the import album's visible count because
Live Photo image/video pairs become one manifest asset and repeated UUIDs are
merged.

If processing fails, inspect these files before retrying:

```text
<OUTPUT>/errors.json
<OUTPUT>/manifest.partial.json
```

Fix the reported issue and rerun the same `process` command. Successful outputs
are reused.

## 8. Upload a staging release

Upload the cumulative private source, excluding Mac-specific export state and
temporary metadata snapshots:

```bash
rclone copy "$SOURCE" "r2:kiana-icloud/$SOURCE_RELEASE" \
  --exclude '.osxphotos_export.db' \
  --exclude 'mediaforge-metadata.*.json' \
  --progress

rclone check "$SOURCE" "r2:kiana-icloud/$SOURCE_RELEASE" \
  --exclude '.osxphotos_export.db' \
  --exclude 'mediaforge-metadata.*.json' \
  --one-way --size-only
```

The final `mediaforge-metadata.json` is included. This improves the baseline for
the next Mac without exposing originals publicly.

Upload public media to the dated staging prefix. Upload the manifest last:

```bash
rclone copy "$OUTPUT/images" \
  "r2:kiana-web/releases/$STAGING_RELEASE/images" --progress

rclone copy "$OUTPUT/videos" \
  "r2:kiana-web/releases/$STAGING_RELEASE/videos" --progress

rclone copyto "$OUTPUT/manifest.json" \
  "r2:kiana-web/releases/$STAGING_RELEASE/manifest.json" --progress
```

Check that every local staging file exists remotely:

```bash
rclone check "$OUTPUT" "r2:kiana-web/releases/$STAGING_RELEASE" \
  --one-way --size-only
```

Verify the public manifest and one image through the custom domain:

```bash
STAGING_BASE="https://media.kiana.me/releases/$STAGING_RELEASE"

curl -fsSL "$STAGING_BASE/manifest.json?verify=$(date +%s)" \
  | jq '.schemaVersion, (.assets | length), .revision'

IMAGE_PATH="$(curl -fsSL "$STAGING_BASE/manifest.json?verify=$(date +%s)" \
  | jq -r '.assets[-1].image.large')"
curl -I "$STAGING_BASE/$IMAGE_PATH"
```

The image request should return a successful HTTP status.

## 9. Review staging in the real gallery

Run the web app against the dated release without changing a tracked file:

```bash
VITE_KIANA_MEDIA_BASE_URL="$STAGING_BASE" \
  npm run dev --workspace apps/kiana
```

Open the printed local URL on the Mac. To test on a phone, put the phone and Mac
on the same network and restart with a LAN-accessible host binding:

```bash
VITE_KIANA_MEDIA_BASE_URL="$STAGING_BASE" \
  npm run dev --workspace apps/kiana -- --host 0.0.0.0
```

Open the displayed network URL on the phone. Alternatively, inspect the dated
media URLs directly and promote only after desktop review.

Check at least the following:

- several newly added photos;
- portrait and landscape orientation;
- capture dates;
- Fill, Backdrop, and Mat modes;
- Live Photo motion and its still cover;
- standalone video playback and audio;
- transitions between old and new media;
- browser console and network errors.

Stop here and ask the owner to approve staging before promotion.

## 10. Promote staging to production

After approval, copy staging into `current`. Extra old objects can remain safely;
the manifest determines what appears in the gallery. Copy media first and the
manifest last:

```bash
rclone copy "r2:kiana-web/releases/$STAGING_RELEASE/images" \
  "r2:kiana-web/releases/current/images" --progress

rclone copy "r2:kiana-web/releases/$STAGING_RELEASE/videos" \
  "r2:kiana-web/releases/current/videos" --progress

rclone copyto "r2:kiana-web/releases/$STAGING_RELEASE/manifest.json" \
  "r2:kiana-web/releases/current/manifest.json" --progress
```

Verify production with a cache-busting query:

```bash
curl -fsSL \
  "https://media.kiana.me/releases/current/manifest.json?verify=$(date +%s)" \
  | jq '.schemaVersion, (.assets | length), .revision'

rclone check "$OUTPUT" "r2:kiana-web/releases/current" \
  --one-way --size-only
```

Then open [kiana.me](https://kiana.me) on desktop and mobile. If the old manifest
appears briefly, purge only the URL
`https://media.kiana.me/releases/current/manifest.json` from Cloudflare's cache
or wait for its cached response to expire.

A media-only promotion does **not** require an application commit or Cloudflare
Worker deployment. The deployed app always reads `releases/current`.

## Persistent exclusions

Do not manually remove unwanted assets from generated `manifest.json`; the next
Mediaforge run will recreate them. Add the asset UUID to:

```text
apps/kiana/src/data/excluded-assets.ts
```

The UUID is the filename portion before `-2400.webp`, `-1280.webp`, or `.mp4`.
After editing the list, run:

```bash
npm run check
npm run build --workspace apps/kiana
```

This is an application-code change, so commit it with a
[Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) and push it
only when requested. Cloudflare's Git integration will then deploy the change.

## Rollback

Every dated staging prefix is also a rollback point. To restore a known-good
release, use the same media-first, manifest-last order:

```bash
ROLLBACK_RELEASE="YYYY-MM-DD-known-good"

rclone copy "r2:kiana-web/releases/$ROLLBACK_RELEASE/images" \
  "r2:kiana-web/releases/current/images" --progress

rclone copy "r2:kiana-web/releases/$ROLLBACK_RELEASE/videos" \
  "r2:kiana-web/releases/current/videos" --progress

rclone copyto "r2:kiana-web/releases/$ROLLBACK_RELEASE/manifest.json" \
  "r2:kiana-web/releases/current/manifest.json" --progress
```

Do not delete the failed release while diagnosing it. Its manifest and errors
are useful evidence, and leaving unreferenced media in R2 does not make it appear
in Kiana.

## Troubleshooting

### Photos access is denied

Open Photos once, confirm the intended library is the System Photo Library, and
grant Photos access to Terminal or Codex in System Settings. For another
library, pass `--library` explicitly.

### Export waits on iCloud downloads

Keep Photos open and the Mac awake, verify it has enough free disk space, and
rerun the same export command. Both osxphotos and Mediaforge are incremental.

### `doctor` reports missing tools

Install the reported Homebrew package. `swiftc` comes from Xcode Command Line
Tools, `cwebp` from `webp`, and `ffmpeg`/`ffprobe` from `ffmpeg`.

### Existing Live Photos become ordinary photos

Stop before uploading. This almost always means the metadata merge was skipped
or an incomplete `mediaforge-metadata.json` replaced the cumulative one. Repeat
the bootstrap and metadata merge, then process again.

### The manifest contains only the new Mac's photos

Stop before promotion. The current output was not bootstrapped correctly. Copy
`r2:kiana-web/releases/current` into a fresh local output directory, merge
metadata again, and rerun `process`.

### Rclone cannot list buckets

A bucket-scoped token may lack the account-level permission needed by
`rclone lsd r2:`. Test the two explicit bucket paths instead and set
`no_check_bucket = true`. If direct access also fails, check the token's bucket
scope, endpoint account ID, and Object Read & Write permission.

### A staging asset returns 404

Do not promote. Run `rclone check`, confirm the manifest's path is relative to
the same staging prefix, and re-copy images/videos before re-copying the
manifest.

### A photo is duplicated

Mediaforge deduplicates matching Apple Photos UUIDs, not visually identical
copies imported separately. Remove the duplicate from the Photos import album
or add its UUID to the persistent exclusion list.

## Optional local cleanup

The ignored `kiana-icloud/` and `kiana-web/` directories can be removed from the
second Mac after production and rollback verification if disk space is needed.
Do not use a broad or variable-based recursive delete. Resolve and inspect the
exact paths first, or ask Codex to do a safe targeted cleanup.
