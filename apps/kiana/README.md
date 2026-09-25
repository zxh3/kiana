# Kiana web app

The Kiana gallery is a TanStack Start app styled with Tailwind CSS. It reads a
Mediaforge release manifest and displays the responsive images described by it.

## Playback

- Photos stay on screen for 10 seconds by default; the slideshow settings offer
  5 seconds, 20 seconds, or a minute.
- Live Photos play their motion once during the slide.
- Regular videos play once at their full duration; the bottom bar follows video
  progress instead of the photo timer.
- **Sound.** The dock's sound button opens a mixer with three independent
  channels, each with a switch (whether it is heard) and a slider (how loud):
  videos (Live Photos and regular videos), music, and interface sounds. Video
  sound starts off on every visit so browser autoplay stays reliable, and M
  turns it on or off; music can be muted without pausing it; interface sounds
  are on by default. Moving the slider of a channel that is off turns it on.
  The button shows a muted speaker only when nothing can be heard. The mixer
  lives in `src/components/gallery/sound`.
- Controls appear when the pointer moves or a key is pressed and fade after a
  few seconds, so the page stays clean when left running as a photo frame. On
  touch screens, tap to show them and swipe sideways to move between photos.

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
- **Favorites.** For people signed in with Google: the heart saves a photo to
  their account, kept by the Worker (`src/server/favorites.ts`, at
  `/api/favorites`) in the accounts database, so favorites are the same on
  every device, and are read again whenever the page comes back into view.
  A heart shows at once and is saved in the background; if saving fails it
  goes back, with a short notice. For a guest the heart (and L) offers to
  sign in, which comes back to the same photo and saves it; Favorites in
  the collection menu and the library ask them to sign in.
  Favorites kept in a browser before signing in came are added to the
  account the first time it signs in there, then cleared.
- **Share.** Copies a link that opens the current photo. The server renders
  that photo as the link preview image.
- **Music.** The player button in the top bar, only an icon of the pocket
  player with bars dancing on its screen while music plays (its label and
  tooltip say what a press does), plays a five-song YouTube playlist as
  background music. The player is made like the pocket music players of the
  2000s, in silver, graphite, or rose aluminium. Its colour screen has a top
  menu titled with the device's name, laid out as on the original: Music
  (Cover Flow and Songs), Apps, and Settings, each a level down, then
  Shuffle Songs and Now Playing last. Its right half previews the
  highlighted item, and both the click wheel and
  the touch screen drive it. Circle a thumb or the pointer around the wheel,
  or scroll over the player, to move through lists and flip through covers; on
  the screen, drag a list or tap a row, swipe or tap the covers, press or drag
  along the progress bar to seek, and tap the title bar to go back. On Now
  Playing the wheel sets the volume, and the centre button brings up a
  scrubber for the wheel to seek with. Menu goes back (and does nothing at the
  top menu, so pressing it repeatedly is safe), and the wheel's other buttons
  are previous, next, and play or pause. As on the original there is no up or
  down button, and held buttons do more: ⏮ and ⏭ rewind and fast-forward, Menu
  turns the backlight off or on, and play puts the player to sleep until the
  next touch. The hold switch, a small slot in the aluminium above the screen,
  locks every control and shows a padlock. The screen dims ten seconds after
  the last touch, and the battery shows the viewer's own where the browser
  shares it. Apps, where the original kept its games under Extras, holds
  the little apps, shown as icons in the top menu's preview. The first is a
  finger spinner: each click of the wheel flicks it faster the way it turned (and
  back the other way to brake), the centre button or a tap gives it a bigger
  flick, a sideways swipe on the screen winds it too, and let go it coasts
  down silently, blurring at speed, with its rpm and best shown below.
  Kiana sits on its cap, which stays upright while the rest spins. Its art
  was generated with OpenAI's gpt-image-2.5-sunburst, Kiana's faces from
  her photos, and each spinner made exactly symmetric so it turns without
  wobbling. The second is a Chat Room, where everyone with it open
  talks in one room. Its top strip says how many are online and opens the
  Online list (as does the centre button), the messages fill the middle,
  newest at the bottom, followed by who is typing ("amy is typing…", for a
  few seconds after their last key), and the field below sends one with
  Enter; the wheel scrolls the messages. Typing is only ever passed on live,
  never what was typed, at most every two seconds while someone types. Everyone starts as user_ and four digits, kept
  between visits, and picks another name from their own row, first in the
  Online list, which opens Your Name. Someone signed in with Google goes by
  their first name instead, marked with a blue tick in the messages and the
  Online list, and cannot pick another; a guest can take any name, but never
  the tick. The viewer's own name is blue in the messages: a guest's only
  on what they sent since connecting, and someone signed in's on everything
  their account sent, from any device or visit. The room is a Cloudflare Durable
  Object (`src/server/chat-room.ts`) that the page reaches by WebSocket at
  `/api/chat`: it keeps the last 50 messages in its SQLite storage, deletes
  each a day after it was sent (by an alarm, even while nobody is there), tells
  everyone who is here as people come and go, and allows five messages
  every ten seconds each. Names are at most 16 characters and messages 200,
  both one line of plain text. It is joined only while one of its screens
  shows, and there is no moderation beyond those limits. The third is 电子木鱼,
  the electronic wooden fish, with Kiana in place of the fish: each tap on
  her, or press of the centre button, pats her head for one more merit
  (猫德, cat merit, after the wooden fish's 功德). A hand comes down, her
  head gives under it, her eyes close and her ears ease back, and "猫德 +1"
  floats up; patting fast keeps the hand moving and her eyes closed. The merit is one count that everyone adds to,
  starting from nothing, kept by another Durable Object
  (`src/server/wooden-fish.ts`) at `/api/muyu`, so it climbs live as other
  people pat. Pats show at once and are sent together, four times a second
  at most, and each person's count at most 20 a second. Beside her are
  everyone's merit, the viewer's own (kept between visits), and how many
  are patting. A guest's own merit is kept in their browser; someone
  signed in has it kept by their account, the same on every device, and
  their guest count stays behind for when they sign out. Her pictures and the hand were generated with OpenAI's
  gpt-image-2.5-sunburst, Kiana from her photos. Settings, named as on the original, holds first Account,
  which shows who is signed in and opens a screen to sign in with Google or
  sign out, then Shuffle (on or off) and Repeat (all or one) as two separate
  settings, the backlight timer, the clicker (the wheel's ticks), the
  finish, and last Finger Spinner, a screen of the spinner's looks: Spinner
  (Stealth, Claw, or Machined) and Kiana (Curious, Calm, or Shades). On phones the controls tap
  back through the vibration motor. Android taps with every sound, including
  each click of a turning wheel, through the Vibration API; turning the
  clicker off stops the wheel's taps too. Safari on iOS has no Vibration API,
  but taps when a native switch control is toggled by a touch, so each of the
  player's buttons, rows, and covers carries an invisible label for a hidden
  switch (`HapticTap`, after the ios-haptics library). The wheel's ring is
  covered by an invisible switch of its own, which keeps its middle just
  beside the finger and moves it across on each click; Safari reads that as
  the finger sliding the switch and taps, so iPhones feel the wheel's clicks
  too. A tap on the ring presses the button in that quarter of it. A tap on the cover on Now
  Playing plays the song's video on the screen, under the title bar, which
  goes back like Menu. Minimize and close are two small dimples in the
  aluminium above the screen, opposite the hold switch, faint until the
  pointer is over the player or the controls show. Minimized (the default on
  phones), it becomes a small square player showing the cover: the full player
  shrinks into its corner as the small one grows out of it, and back. On wider
  screens it can be dragged to any corner by the grip at the bottom of its
  body (the small player from anywhere), where it stays; on phones the full
  player rises from the bottom edge. Songs YouTube refuses to embed are
  skipped. YouTube's player stays mounted but hidden by default; it covers the
  display when YouTube needs a tap or a sign-in, or when the cover on Now
  Playing is tapped. Hiding a playing embed goes against YouTube's API
  policies (III.I.9), so YouTube could stop the songs playing here. The player
  uses youtube.com rather than youtube-nocookie.com, because a YouTube sign-in
  in the same browser is what clears YouTube's "confirm you're not a bot"
  check. The music lives in `src/components/gallery/music`: playback in
  `use-music.ts`, the playlist in `music-track.ts`, and the widget in
  `music-player.tsx`. The device lives in `src/components/gallery/pod`: its
  behaviour as a pure, tested state machine in `machine.ts`, run by
  `use-pod.ts`, its shared screens in `pod/screen`, its hardware (the wheel,
  the buttons, the hold switch) in `pod/device`, and each app, with its
  rules, hook, screen, and art, in `pod/apps/spinner`, `pod/apps/chat`, and
  `pod/apps/muyu`.
- **Signing in.** Signing in with Google, from the player's Settings →
  Account or the heart, keeps favorites, and gives a verified name in the
  Chat Room and merit of one's own in 电子木鱼 that follows the account.
  It goes to Google and comes back to the same page; signing out stays on
  it. It is run by [Better Auth](https://www.better-auth.com) in the Worker
  (`src/server/auth.ts`), at `/api/auth`, which keeps each person's Google
  name (first name only), email, and picture, and their sessions, in a
  Cloudflare D1 database, `kiana-auth`, and creates or updates its tables
  itself. When the Chat Room or 电子木鱼 connects, the Worker checks the
  session cookie and passes the account on to the Durable Object; a signed
  copy of the session in a cookie lets it do so without asking the
  database for five minutes at a time. In the browser it is Better Auth's
  client, in `src/lib/auth-client.ts`, read by the gallery and the player
  through `gallery/use-account.ts`.
- **Interface sounds.** Soft clicks, ticks, and chimes answer the controls.
  They are on by default, with their own switch and level in the sound mixer.
  The sounds are generated in code with the Web Audio API, so there are no
  audio files and nothing to license, and they only ever answer something the
  viewer did: the slide timer and song endings stay silent. The module lives
  in `src/lib/sounds`: building blocks in `synth.ts`, named sounds in
  `recipes.ts`, the sound for each action in `cues.ts`, rate limits in
  `gate.ts`, and the audio context, level, and switch in `engine.ts`.
- **Keep screen awake.** An optional setting that holds a screen wake lock
  while photos play.

Preferences, date-order positions, and the music volume, song,
mute, shuffle, repeat, player size, corner, finish, backlight, and clicker, the
finger spinner's best speed, spinner, and face, the Chat Room name, a guest's own 猫德, the video sound level, and the interface sounds switch and level are stored in
local storage under `kiana.*` keys.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Play or pause |
| ← → | Previous or next |
| L | Favorite |
| S | Share a link |
| M | Video sound on or off |
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

The development server runs the Worker in Cloudflare's own runtime, so the
Chat Room and 电子木鱼 work locally too: their Durable Objects and storage are
simulated under `.wrangler/state`, separate from production's. Delete that
folder to empty the local room and count. The Worker's entry is
`src/server.ts`, which puts their WebSockets in front of TanStack Start and
exports the Durable Object classes. After changing `wrangler.jsonc`, run `npm run cf-typegen` to
regenerate `worker-configuration.d.ts`.

### Signing in with Google

Signing in needs a Google OAuth client and three secrets. Without them, as
in a fresh checkout, Account shows Off and everyone is a guest.

1. In the Google Cloud console, under APIs & Services → Credentials, create
   an OAuth client ID of type Web application, with the authorized
   redirect URIs `https://kiana.me/api/auth/callback/google` and
   `http://localhost:3000/api/auth/callback/google`. The consent screen
   asks for an app name and a privacy policy link.
2. For local development, put the same three in `apps/kiana/.env`, as
   listed in `.env.example`, with a secret from
   `openssl rand -base64 32`. The development server passes them to the
   Worker.

3. For the site, set the same three on the Worker, in the Cloudflare
   dashboard (Workers → kiana → Settings → Variables and Secrets) or from
   `apps/kiana`:

   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```

`wrangler.jsonc` lists them under `secrets.required`, so a deploy fails
until all three are set on the Worker. The `kiana-auth` D1 database has no
id in `wrangler.jsonc`: Cloudflare creates it on the first deploy that has
it and finds it by the Worker after that. Locally it is simulated under
`.wrangler/state` with the Durable Objects. Changing `BETTER_AUTH_SECRET`
signs everyone out.

A change to the `migrations` in `wrangler.jsonc` (a new, renamed, or deleted
Durable Object class) can only ship from `main`. Workers Builds uploads a
branch as a version, and Cloudflare refuses a version that includes a
migration (error 10211), so that branch's build fails until it is merged;
`main` runs `wrangler deploy`, which applies it. Renaming or deleting a class
moves or wipes what it stores (the messages, or the merit).

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
npx tsc --project apps/kiana/tsconfig.worker.json --noEmit
npm run build --workspace apps/kiana
```

The Worker's code is checked on its own, by `tsconfig.worker.json`, because
Cloudflare's runtime types clash with the browser's.
