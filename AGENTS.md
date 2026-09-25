# Agent instructions

- Use [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages (for example, `feat: add photo gallery`).

## Repository

- `apps/kiana`: the photo gallery at kiana.me. TanStack Start, React 19,
  Tailwind v4, and `motion`, deployed to Cloudflare Workers.
- `packages/mediaforge`: the Python CLI that prepares the photo releases.
- Setup, checks, and workflows are in [`docs/development.md`](docs/development.md).

## Deploys

- Cloudflare Workers Builds deploys **every branch push to production**, so
  pushing a PR branch changes the live kiana.me before it is merged. Say so
  when you push, and do not push half-finished work to a branch.
- A deploy fails until the Worker has every secret listed under
  `secrets.required` in `apps/kiana/wrangler.jsonc` (signing in with
  Google's); set them before merging a change that adds one.

## Checks

Before committing web app changes, run from the repository root:

```bash
npx tsc --noEmit -p apps/kiana
npx tsc --noEmit -p apps/kiana/tsconfig.worker.json
npm test -w apps/kiana
npm run check
npm run build
```

`npm run check` is Biome; `npm run check:fix` applies its safe fixes. For
Python changes, run the `uv` checks listed in `docs/development.md`.

## Web app

- **Layout.** `src/components/gallery` is the slideshow. `gallery/music` is
  the background music: `use-music.ts` drives a YouTube embed, and `pod/` is
  the click-wheel player. `gallery/sound` is the sound mixer. `src/lib/sounds`
  generates the interface sounds, and `src/lib/motion.ts` holds the shared
  animation presets. `src/server.ts` is the Worker's entry: TanStack Start,
  with signing in, favorites, and the pod's live apps in front of it.
  Signing in with Google is Better Auth in `src/server/auth.ts`, on a D1
  database, which also keeps each account's favorites
  (`src/server/favorites.ts`, with `src/lib/favorites.ts`); the
  live apps are each a Durable Object, told who is connecting by the
  Worker (`src/server/account.ts`): the chat room in
  `src/server/chat-room.ts`, whose rules live in `src/lib/chat.ts`, and
  the wooden fish's merit in `src/server/wooden-fish.ts`, with
  `src/lib/muyu.ts`. The Worker's code has its own `tsconfig.worker.json`,
  since Cloudflare's runtime types clash with the browser's.
- **Logic stays pure and tested.** The music player's behaviour is a pure
  state machine in `pod/machine.ts` with unit tests; its components only
  draw. Follow that shape: put rules in plain functions or reducers with
  tests next to them, and keep components thin.
- **Stored preferences** live in localStorage under `kiana.*` keys through
  `useStoredState`. Their `parse*` functions must tolerate missing or junk
  values. List new keys in `apps/kiana/README.md`.
- **Sounds and motion.** Play interface sounds with `cue("name")` from a
  handler for something the viewer did, never from a timer. Reuse the small
  set of sounds in `lib/sounds/cues.ts` rather than adding new ones. Use the
  `springs` and `fades` presets for animation.
- **Browser autoplay.** Clips start muted, and video sound is not kept
  between visits, so unmuted autoplay never gets blocked.
- **Deliberate choices; ask before changing them.** The YouTube embed uses
  youtube.com, not youtube-nocookie.com, because a YouTube sign-in is what
  clears its bot check. The embed stays mounted for the widget's whole life
  and is hidden unless needed, which YouTube's API policies (III.I.9) do not
  allow; that was the site owner's decision.
- Update `apps/kiana/README.md` when behaviour changes. Comments explain why,
  in full sentences, matching the surrounding code.

## Testing in the browser

- Start the web app with the `kiana` configuration in `.claude/launch.json`
  (port 3000).
- **YouTube will not play in an automated browser**: it shows its bot check
  or error 150. To exercise the music player, set a fake `window.YT.Player`
  before pressing Music; the loader in `music/youtube-api.ts` uses an
  existing `window.YT`. Real playback still needs a person to check it.
- **A hidden browser pane pauses animation frames**, so `motion` animations
  and exiting screens can look stuck until a screenshot renders a frame.
  Check again before calling it a bug.
- **The browser tool's drag gesture is unreliable** for pointer-driven
  controls such as the drag handle and swipes. Dispatch `PointerEvent`s from
  JavaScript instead.
- After a change to the order of hooks, such as a new hook in `useMusic`,
  hot reload can show "calling hooks conditionally". Reload the page fully.
