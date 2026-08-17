# Kiana web app

The Kiana gallery is a TanStack Start app styled with Tailwind CSS. It reads a
Mediaforge release manifest and displays the responsive images described by it.

## Playback

- Photos remain on screen for 10 seconds.
- Live Photos loop their video for the same 10-second slide.
- Regular videos play once at their full duration; the bottom bar follows video
  progress instead of the photo timer.
- The global sound button controls both Live Photos and regular videos. Playback
  starts muted so browser autoplay remains reliable.

## Development

From the repository root:

```bash
npm install
npm run dev
```

Without configuration, the app loads the current release from
`https://media.kiana.me/releases/current`.

## Cloudflare R2 media

Production media belongs in the public `kiana-web` R2 bucket. Private originals
remain in the separate, non-public `kiana-icloud` bucket and are never accessed
by this app.

Process and upload a dated release as described in the
[Mediaforge README](../../packages/mediaforge/README.md). The resulting R2
objects have this shape:

```text
releases/<release>/
├── images/
├── videos/
└── manifest.json
```

The `kiana-web` bucket is connected to the `media.kiana.me` custom domain. To
test another release, copy the example environment file and override its URL:

```bash
cp apps/kiana/.env.example apps/kiana/.env.local
```

```dotenv
VITE_KIANA_MEDIA_BASE_URL=https://media.kiana.me/releases/current
```

Restart the development server after changing the environment. The route fetches
`<base-url>/manifest.json`, validates Mediaforge schema version 1, and resolves
its image paths against the same release URL. A missing or invalid manifest
fails visibly instead of silently serving stale media.

Gallery-specific curation lives in `src/data/excluded-assets.ts`. Add an asset
UUID there to keep it out of the gallery across regenerated manifest uploads.

Cloudflare's `r2.dev` URL is suitable for temporary testing but is rate-limited;
use a custom domain for production traffic and caching.

## Checks

```bash
npx tsc --project apps/kiana/tsconfig.json --noEmit
npm run build --workspace apps/kiana
```
