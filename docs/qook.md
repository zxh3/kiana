# qook — design doc

qook is a thin console over compute the user already owns. You bring a Modal
token; qook creates sandboxes in *your* Modal workspace and gives you three
doors into each one — a terminal, an agent (herdr), and an editor. It never
bills you and never claims work it doesn't do: sandboxes run and are billed in
your Modal account.

Source of truth for the visual design: the Claude Design project
[Kianax Console](https://claude.ai/design/p/25527a8c-b851-48f0-a00f-83a1fcc5cc03?file=Kianax+Console.dc.html)
(`Kianax Console.dc.html`, turns 4 / 8 / 10 — the product was designed as
"kianax" and later renamed to **qook** (pronounced "cook"; future home: qook.dev on Cloudflare Workers)). This doc transcribes that design
and adds the implementation architecture.

## 1. Product surface

Four screens, nothing else.

| # | Screen | Purpose |
|---|--------|---------|
| 1 | **Connect** (`/connect`) | Paste a Modal token (ID + secret) and an optional Modal environment. Credentials live only in the browser's localStorage — stated in-line — and Disconnect clears them. Skipped entirely when the server carries `MODAL_*` env vars (deployment mode). |
| 2 | **Sandboxes** (`/`) | Running sandboxes come from Modal (the only server-side truth); **stopped rows come from the browser**: every sandbox's spec is remembered in localStorage (`qook-sandboxes:<workspace>`), so terminated sandboxes stay listed as dim Stopped rows with a Start button that recreates them from the remembered spec — and name-keyed volume state makes that a resume. Start auto-retries through the few seconds it takes Modal to free the name. Stopped rows also offer Forget (drops the browser record; volume state stays until the name is reused). Browser-local: another browser won't see your stopped rows. One primary action: `+ Create sandbox`. Rows have `Enter ▾` (zsh / herdr / vscode / browser), an always-present volumes chip (counting the built-in workspace mount, so ≥ `1 vol`) whose popover lists user mounts followed by a `BUILT-IN · qook-state/sandboxes/<name>/` section enumerating all ten persisted paths (workspace, herdr config/share/state, code-server User/extensions, claude/codex/pi state, bash history), and an overflow menu with Terminate. A ↻ button re-polls; a visible tab re-polls every 30s. |
| 3 | **Create sandbox** (drawer over `/`) | Name, CPU chips, memory slider, GPU chips (Modal's full range: T4 → B300) + GPU count chips (`A10G:2`), base image, volume mounts (repeatable, up to 8). The built-in state mount appears as the first row — disabled, labeled `built-in`, showing its real volume path (`qook-state/sandboxes/<name>/workspace → /workspace`) and live-updating as the name is typed; an expander beneath lists every other path persisted on the mount (herdr, code-server, agent state, shell history — the `builtinMounts` list in `types.ts`, kept in sync with the boot script). Reusing a previous name resumes its /workspace. |
| 4 | **Session** (`/s/[sandboxId]?mode=bash\|herdr\|vscode`) | One 46px session bar; panes below, edge to edge. Mode switching is client-state only — panes stay mounted. Terminate lives in the overflow menu; a gone sandbox shows a "no longer running" notice. |

Flow: connect token → sandbox list → create → enter. Terminate ends the
Modal sandbox but keeps its row (browser-remembered) as Stopped; Start
recreates it and resumes its name-keyed state.

## 2. Design language

The interface stays quiet: near-black surfaces, hairline structure, one accent
that only ever marks the next action or a live value. Nothing decorative
competes with the terminal.

### 2.1 Color

Surfaces & accent:

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#0A0A0B` | Page background |
| `drawer` | `#0E0E10` | Side drawers |
| `overlay` | `#141416` | Menus, popovers |
| `accent` | `#C6F24E` | Lime. The single accent (turn 10, option 9k — "current"). |
| `running` | `#5FD08A` | Status: running |
| `failed` | `#E2725B` | Status: failed, destructive buttons |
| `warn` | `#F0B429` | Pending / needs-review states |

Ink (text tiers):

| Token | Hex | Use |
|---|---|---|
| `ink` | `#EDEDEF` | Primary text |
| `control` | `#C9C9CF` | Control text (outline buttons, terminal body) |
| `data` | `#9A9AA2` | Data values (specs, uptimes) |
| `secondary` | `#7A7A83` | Secondary copy |
| `muted` | `#5E5E66` | Section labels, hints |
| `disabled` | `#4A4A52` | Disabled, gutter numbers |

Rules:

- Borders are **always white at low alpha**, never a solid grey: `.06` row
  dividers, `.08` structural rules, `.12–.14` controls.
- Status colours appear as a **6px dot plus a word**; colour alone never
  carries meaning. The dot gets a soft halo (`0 0 0 3px` at 16% alpha) only
  when the thing is live.
- The accent marks exactly one thing per view: the most likely next action
  (filled button), the focused field's border/caret, or a live value. Green,
  amber and red belong to status alone.
- Destructive actions borrow the failed colour and are never the accent.

### 2.2 Type

IBM Plex Sans for language, IBM Plex Mono for machine. Anything a user could
type, copy, or grep — names, specs, ports, hostnames, log lines — is mono.
Everything they merely read is sans. Nothing on screen sits below 10px.

| Role | Spec |
|---|---|
| Page title ("Sandboxes") | sans 600 · 19px / 1.1 · −0.3px tracking |
| Drawer title ("Create sandbox") | sans 600 · 17px / 1.1 |
| Entity name ("SB-1") | mono 600 · 13.5px |
| Data ("8 vCPU · 32 GiB · A10G") | mono 400 · 12px |
| Body copy | sans 400 · 12.5px / 1.5 |
| Section label ("SANDBOX") | mono 600 · 10px · +0.9px tracking, muted |

### 2.3 Space & shape

- 4px base grid. 6–8 inside a control; 16 between table columns; 20–22 for
  field groups and page gutters; table rows pad 14 vertical / 22 side.
- Radius belongs to things that float: 5px chips, 6px buttons, 7px inputs,
  9px panels. Tables and page chrome stay square.
- One shadow only, on overlays: `0 18px 44px rgba(0,0,0,.6)`.

### 2.4 Component rules

- **Buttons** — accent fill marks the single most likely next action on a
  screen; every other action is a 1px `white/.12` outline. Small buttons are
  `6px 11px` @ 11.5px; regular `8–10px 14–18px` @ 12.5px.
- **Rows** — selected: 5% accent tint + 2px inset accent bar. Inactive
  (stopped): whole row at 72% opacity, no grey repaint.
- **Fields** — resting: `white/.10` border on `white/.02`; focused: 45%-alpha
  accent border, accent caret. Chip groups (CPU, GPU) select with accent
  border + 12% accent fill.
- **Session bar** — one 46px row carries the whole session: back, name, live
  state, specs on the left; a segmented switcher for the three modes
  middle-right (accent only on the active mode's glyph — it marks which door
  you're standing in, not something to click); forwarded ports as dot+number
  with `+`; a single overflow menu holding Stop.
- **Status** — Running `#5FD08A` (halo), Stopped `#6A6A72` (no halo),
  Failed `#E2725B`.

### 2.5 Voice

- Labels are nouns, buttons are verbs: **Create sandbox**, not "Create a new
  sandbox now".
- State the machine truth: "Runs in your Modal workspace." Never claim work
  Qook does not do. "Sandboxes are billed by Modal, not by Qook."
- Errors name the cause and the fix in one line, then offer the action that
  resolves it.
- Numbers keep their units and never round away meaning: `18.4 / 32 GiB`.

## 3. Architecture

### 3.1 Stack

| Layer | Choice |
|---|---|
| App | SvelteKit (Svelte 5, runes), client-rendered (`ssr = false`) — existing `apps/qook` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), tokens as `@theme` variables |
| Headless UI | bits-ui (DropdownMenu, Dialog, Select, Slider, Popover) |
| Auth | none — Modal credentials in the browser's localStorage (or server env vars) |
| State | none — Modal is the single source of truth (tags + volumes + derived secrets) |
| Compute | Modal — the official `modal` JS SDK, behind `src/lib/server/modal.ts` (see 3.4) |

### 3.2 State model (no database)

- **Sandbox memory** — `qook-sandboxes:<workspace>` in localStorage: spec +
  createdAt + stoppedAt per name, reconciled against Modal's running list on
  every load (running sandboxes are re-recorded; missing ones get stamped
  stopped). This is UX memory only — losing it loses nothing but the stopped
  rows; volume state is untouched.
- **Credentials** — `{tokenId, tokenSecret, environment, workspace}` in the
  browser's localStorage, attached to every API call as `x-modal-*` headers.
  Server-side `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` / `MODAL_ENVIRONMENT`
  env vars act as the fallback (deployment mode); headers win when both
  exist.
- **Sandbox spec** — stored as Modal tags at create time (`qook=1`,
  `qook-name/-image/-cpu/-memory/-gpu/-gpu-count/-volumes/-created`), so
  the table renders from Modal data alone. Modal also enforces name
  uniqueness among running sandboxes (`name` create option).
- **Pane auth secret** — derived, never stored:
  `HMAC-SHA256(tokenSecret, "qook-pane:" + name)`, computed per request and
  injected as boot env at create.
- **Persistent state** — the shared `qook-state` volume, subPath keyed by
  sandbox **name** (`sandboxes/<name>`), so a new sandbox with an old name
  resumes its /workspace, herdr sessions, and vscode extensions.

### 3.3 Routes

```
/connect              token + environment form; localStorage disclosure; Disconnect
/                     running sandboxes; create drawer; terminate
/s/[sandboxId]        session panes (?mode=zsh|herdr|vscode)

/api/connection       GET  verify resolved credentials → workspace
/api/sandboxes        GET  list (qook-tagged, running)  ·  POST create
/api/sandboxes/[id]   GET  session detail (tags, tunnels, pane readiness)  ·  DELETE terminate
```

Pages are client-rendered; loads run in the browser and call the API with
credential headers. 401 anywhere redirects to `/connect`.

### 3.4 Modal boundary (stateless)

All Modal calls live in `src/lib/server/modal.ts`, one short-lived
`ModalClient` per request from the resolved credentials:

- `verifyToken` — `WorkspaceNameLookup` RPC; returns the real workspace.
- `listSandboxes` — `sandboxes.list({appId, tags: {qook: "1"}})` +
  `getTags()` per sandbox → the full table row. Only running sandboxes exist.
- `launchSandbox` — runtime image (see 3.5) + state-volume subPath + user
  volumes + boot command + spec tags. GPU in Modal syntax (`A10G:2`),
  lifetime 24h (Modal's max; SDK default is 5 minutes).
- `getSession` — `fromId` + `poll()` (gone sandboxes 404) + `tunnels()` +
  per-pane readiness probes.
- `terminateSandbox` — `fromId(id).terminate()`; NotFound/Invalid count as
  already gone.

### 3.5 Session runtime (zsh / herdr / vscode / browser)

`src/lib/server/runtime.ts` defines the runtime in two halves:

**Image layer.** Every base image gets the same pinned layer via
`dockerfileCommands`: ttyd 1.7.7 (web terminal), code-server 4.133.0, Caddy
2.11.4 (auth proxy), herdr (herdr.dev — terminal workspace manager for
agents), zsh + oh-my-zsh (default shell, `git` + `zsh-autosuggestions`
plugins, async git prompt disabled so branch info is synchronous, theme:
`robbyrussell` — `➜ dir git:(branch) ✗`), Node 22, and three preinstalled agent
CLIs herdr detects out of the
box: **Claude Code** (`@anthropic-ai/claude-code`), **Codex**
(`@openai/codex`) and **pi** (`@earendil-works/pi-coding-agent`). Modal's
layer cache freezes whatever versions npm resolved on first build — bump the
comment marker in the npm layer to force a refresh. Modal caches image builds by layer content: the first launch per base
image builds (~30s–3min), every launch after reuses it. Builds are lazy — no
pre-warming.

**Boot script.** Passed as the sandbox's create command, never baked into the
image, so the per-sandbox secret stays out of the shared image cache. It wires
persistence, writes the Caddyfile from `QOOK_SECRET`, and starts the
services; if any dies the script exits nonzero and the reconciler marks the
sandbox failed.

| Public port | Service | Pane |
|---|---|---|
| 7681 | ttyd → `zsh` (oh-my-zsh: git + zsh-autosuggestions) in /workspace | zsh |
| 7683 | ttyd → `herdr` (full TUI; mouse works through xterm) | herdr |
| 8443 | code-server on /workspace | vscode |

| 8080 | whatever the user runs on sandbox port 3000 | browser |

Caddy owns the public ports; the services bind to localhost only. The
**browser** pane proxies to sandbox port 3000 behind the same cookie auth —
run any dev server on 3000 and it appears in the tab; until then Caddy
serves a friendly "nothing is listening on port 3000" message. The pane has
a slim toolbar: reload, a path address bar (type `/route`, Enter), and
open-in-new-tab. The iframe is cross-origin, so its live URL can't be read
and true back/forward can't be driven from the parent — those would need
same-origin proxying through the qook server.

**Shells everywhere are zsh**: the boot env exports `SHELL=/usr/bin/zsh`
(inherited by herdr, whose panes fall back to `$SHELL`), root's login shell
is zsh, and fresh herdr configs are seeded with
`[terminal] default_shell = "zsh"` — user-editable on the volume at
`herdr/config/config.toml`.

**Auth.** Pane iframes load `https://<tunnel>/qook-auth?token=<secret>`;
Caddy answers 302 + an `HttpOnly; Secure; SameSite=None` cookie, and every
later request — WebSockets included — must carry it (403 otherwise). The
secret is per-sandbox, minted at first launch, AES-encrypted at rest, and
stripped from all client payloads except the pane URL itself. Chrome-first:
Safari's ITP blocks third-party cookies (Modal connect tokens are the upgrade
path).

**Persistence is legible in-product.** The create drawer's name hint states
that the name *is* the state identity; every zsh pane greets with a one-time
MOTD ("… persist across restarts of sb-3; everything else resets on
terminate; type qook for details"); and a `qook` command baked into every
sandbox prints the persistence map — separating what persists now from
installs that *would* persist, with live detection (rust shows "installed
(1.98.0) - persisted" when present, or the rustup one-liner when not). Toolchains are covered
too: `CARGO_HOME`/`RUSTUP_HOME` and npm's global prefix point at
`/qook-state/tools/…`, so `rustup` and `npm i -g` survive restarts without
the user doing anything. Recreate-after-terminate note: the name frees a few
seconds after termination, so an immediate recreate can briefly get "already
running" — retry.

**Persistence.** One shared Modal volume (`qook-state`) serves the whole
workspace; each sandbox mounts the subPath `sandboxes/<name>` at
/qook-state — keyed by name, so terminating a sandbox and creating another
with the same name resumes its state. Subpaths stay isolated from each
other. `/workspace`, herdr's config/state dirs, and code-server's `User/` +
`extensions/` dirs are symlinks onto it — so files, herdr sessions, vscode
settings/UI state and installed extensions all survive restarts. Only those
two code-server subdirs move: the data-dir root stays local because it holds
code-server's IPC socket, and sockets can't live on a volume (same reason as
herdr's `HERDR_SOCKET_PATH`). The UI
states this: the create drawer notes that `/workspace` persists automatically,
and the volumes popover lists `qook-state → /workspace` as a built-in row
above the user's mounts (the `n vols` chip counts only user mounts — the
built-in one is universal, so a per-row indicator would carry no signal). Files, herdr session structure, pane history (seeded
config.toml enables `[experimental] pane_history`) and agent-resume ids
survive terminate → recreate, and so does agent state: Claude Code via
`CLAUDE_CONFIG_DIR`, Codex via `CODEX_HOME` (both pointed at
`/qook-state/agents/…`), pi via a `~/.pi` symlink, plus bash history via
`HISTFILE`. Users log the agents in once; the credentials and sessions stick.
(Volume commits happen in the background — writes made in the last few
seconds before an abrupt termination can be lost.) Running
processes and anything installed outside /workspace do not — same as a machine reboot, which is what herdr's restore
is designed around. Gotcha: unix sockets can't live on a volume, so
`HERDR_SOCKET_PATH=/tmp/herdr.sock`. `/workspace` and `/qook-state` are
reserved mount paths — the create form rejects user volumes there.

**Multi-client behavior** (two browsers on the same sandbox): the **herdr**
pane is fully synced — every connection attaches to the same herdr session,
keystrokes and output mirror live (that is herdr's purpose). **vscode** is
one shared code-server: same files, extensions and settings, but each window
keeps its own layout. **zsh** is NOT synced — ttyd spawns a fresh shell per
connection, so two browsers get two shells; use the herdr pane for terminals
that should be shared or survive disconnects.

**Session page.** The load probes all three panes' tunnels server-side
(`ready` per mode); the page shows a "starting …" splash and re-polls every
3s until each service answers. Mode switching is pure client state — panes
mount lazily on first visit and then stay mounted (hidden with
`display:none`), so switching bash → vscode → bash never severs the
terminal's WebSocket or spawns a fresh shell. The URL stays deep-linkable via
`replaceState(?mode=…)`.

### 3.6 Environment

```
MODAL_TOKEN_ID         all optional — when set, the server carries the Modal
MODAL_TOKEN_SECRET     connection (deployment mode) and /connect is skipped;
MODAL_ENVIRONMENT      when unset, credentials come from the browser
```

No database, no docker-compose: `npm run dev` is the whole stack.

### 3.7 Deployment — qook runs on Modal

`apps/qook/deploy.py` deploys the adapter-node build as a Modal Server
(`@app.server`): a Node 22 image that copies the source, runs
`npm install && npm run build` at image-build time, and starts
`node build` from `@modal.enter()`. Deploy with:

```
modal deploy apps/qook/deploy.py
```

Live at `https://<workspace>--qook-qookserver.us-east.modal.direct` (deploy
into a specific Modal environment with `modal deploy --env <name>`; e.g. the
modal-labs/xiaohua-dev instance lives at
`modal-labs-xiaohua-dev--qook-qookserver.us-east.modal.direct`) —
scale-to-zero, `unauthenticated=True` (the app has its own credential model;
API calls without Modal credentials get 401). Point qook.dev at it via the
Modal dashboard's custom-domain settings. The control plane thus runs next to
the sandboxes it manages, and the gRPC SDK needs no workaround.

## 4. Out of scope (this iteration)

- Stopped / failed / archived sandboxes — Modal lists running sandboxes only.
  "Resume" is name-keyed state, not a stopped row. A history/archive would
  need a store (a `qook-meta` Modal volume is the natural one, not a DB).
- Safari: pane iframes rely on SameSite=None cookies, which ITP blocks —
  Chrome-first for now (Modal connect tokens are the likely fix).
- Preserving software installed outside /workspace across restarts
  (filesystem snapshots could add this later).
- Teams/orgs — whoever holds the token holds the workspace.
- Usage metering or cost display — billing is Modal's, and the UI says so.
- Light theme. The console is dark-only by design.
- Cloudflare Workers: superseded by the Modal deployment (3.7). The blocker
  stands if revisited — the `modal` JS SDK speaks gRPC over Node's networking
  stack, which Workers does not provide.
