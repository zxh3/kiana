# Kiana web app

The Kiana gallery is a TanStack Start app styled with Tailwind CSS. It reads a
Mediaforge release manifest and displays the responsive images described by it.

## Playback

- Photos stay on screen for 10 seconds by default; the slideshow settings offer
  5 seconds, 20 seconds, or a minute.
- Live Photos play their motion once during the slide.
- Regular videos play once at their full duration; the bottom bar follows video
  progress instead of the photo timer.
- The sound button controls both Live Photos and regular videos. Playback
  starts muted so browser autoplay remains reliable.
- Controls appear when the pointer moves or a key is pressed and fade after a
  few seconds, so the page stays clean as a wallpaper or photo frame. On touch
  screens, tap to show them and swipe sideways to move between photos.

## Features

- **Collections.** Play everything, photos taken on today's date in past years
  ("On this day", widened to the surrounding week when a date is sparse),
  favorites, a single year, or a single month from the library.
- **Order.** Shuffle, or play by date. In shuffle, previous steps back through
  what was shown, and every visit starts a fresh shuffle. By date, previous and
  next always move to the neighbouring photo by date, including after jumping
  to a photo from the library, and each collection resumes where you left it.
- **Frames.** Fill, backdrop, or mat, each with its own transition.
- **Library.** A month-by-month grid of every asset, oldest at the top, with
  filters for photos, Live Photos, videos, and favorites, plus a year rail. It
  opens centred on the playing photo, marked "Now playing". Selecting a tile
  plays from that photo; each month has a Play button.
- **Favorites.** Stored in this browser's local storage and synced between its
  tabs.
- **Share.** Copies a link that opens the current photo. The server renders
  that photo as the link preview image.
- **Music.** The Music button in the top bar loops a YouTube track as
  background music, with play, pause, volume, and a link to YouTube. Starting
  the music mutes clip sound, and turning clip sound on pauses the music.
  YouTube's API policies forbid hidden or audio-only playback and require the
  embedded player to stay visible at 200 × 200 pixels or larger, so the player
  sits in a card above the photos, menus, and library while music is on, and
  nothing is drawn over it. The track is set in
  `src/components/gallery/music-track.ts`.
- **Keep screen awake.** An optional setting that holds a screen wake lock
  while photos play.

Preferences, favorites, date-order positions, and the music volume are
stored in local storage under `kiana.*` keys. The desktop
wallpaper app writes `kiana.frame` on every launch, and the library is rendered
outside `<main>` because that app stretches every image inside `<main>` to cover
the screen.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Play or pause |
| ← → | Previous or next |
| L | Favorite |
| S | Share a link |
| M | Sound on or off |
| G | Open the library |
| F | Full screen |
| 1 2 3 | Fill, backdrop, or mat |
| ? | Show shortcuts |

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
