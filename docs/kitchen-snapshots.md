# Snapshots as the native persistence model

(The product was renamed **kitchen** on 2026-08-22; earlier notes calling it
qook refer to the same thing.)

Status: **implemented**. Every measurement and API claim below was verified
against `cheonghiuwaa` with the `modal` JS SDK 0.9.0 on 2026-08-22.

## The model

A kitchen sandbox **is its filesystem**. Persistence is not a set of paths wired
onto a volume — it is a chain of **snapshots**, each one a published
Modal image captured from the sandbox's own filesystem.

```
kitchen-snap-<sandbox>:<retention>.r<runtime>.<stamp>[.<label>]
```

Volumes remain, but only as an **explicit user choice**: mount one when you
want continuous durability, data shared live between sandboxes, or something
too large to belong in a snapshot.

Everything the old design plumbed by hand — herdr's three directories,
code-server's User and extensions dirs, `~/.pi`, `CLAUDE_CONFIG_DIR`,
`CODEX_HOME`, `CARGO_HOME`, `RUSTUP_HOME`, `NPM_CONFIG_PREFIX`, `HISTFILE` —
now persists because it is simply *in the machine*. So does everything that
list never covered: `apt-get install`, `pip install`, `~/.gitconfig`,
`~/.ssh`, a patched `/etc/apt/sources.list`.

## Why this over a state volume

The previous design split one machine into two durability zones and had to
explain them ("`/workspace` continuously, everything else on stop"). Any rule
with two halves invites "which half is this file in?".

It was also a *leaky* guarantee: volume commits are background, so writes in
the last seconds before an abrupt terminate were already lost. Trading an
implicit leaky promise for an explicit one the user can see and control is a
gain in honesty, not only in simplicity.

The decisive API constraint: **`snapshotDirectory` cannot see a
volume-mounted path** (`INVALID_ARGUMENT: path does not exist`). So a path is
either volume-backed (continuous, no history) or filesystem-backed (history,
saved at snapshot time) — never both. Choosing snapshots as the default puts
history on the things people actually want to travel back through, including
their code.

An elegant consequence: because snapshots exclude volume mounts, **a mounted
volume is simultaneously the "share it / never lose it" tool and the "keep it
out of my snapshots" tool.** One feature, two jobs, no new concepts.

## Verified behaviour

| Property | Result |
|---|---|
| Snapshot, small diff | 0.7–2.1s |
| Snapshot, 1.3 GB Rust toolchain | **9.3s** |
| Create from a snapshot | 0.2s (+~2s first-exec lazy pull) |
| `apt-get install` survives | yes — binary, dpkg database, runs after restore |
| Volume-mounted paths | excluded from snapshots entirely |
| Memory / processes / connections | excluded; a restored sandbox boots fresh |
| `ttlMs: null` | retains the image indefinitely |
| Expiry | distinguishable error: `NOT_FOUND: Image '…' has expired` |
| Extending a TTL | impossible — but `dockerfileCommands(["RUN true"]).build()` yields a **TTL-free** image in 2.4s that survives its parent's expiry *and its parent's deletion*, data intact |
| Layering the current runtime onto a snapshot | works (4.3s in a probe): keeps state, gains the new layer |
| Listing snapshots | `imageListTags({tagPrefix})` → tag, imageId, createdAt |
| Deleting an image | works; the **tag string lingers** and still resolves — only `SandboxCreate` reports `NOT_FOUND` |
| Tag charset | alphanumerics, dashes, periods, underscores; spaces rejected |
| `mountImage(path, image)` | mounts a snapshot into a *running* sandbox; read, diff, `cp` back, `unmountImage` |
| Container-managed files | `/etc/hosts`, `/etc/resolv.conf` are rewritten at boot and do **not** survive; the rest of `/etc` does |

## Lifecycle

- **Create (new name)** — base image + `runtimeCommands`; `/workspace` is a
  plain directory in the image.
- **Start (name has snapshots)** — create from the newest point, or from
  a chosen one. 0.2s.
- **Stop** — snapshot → publish an automatic point → terminate. The row shows
  `saving machine state`. "Discard changes and stop" skips the snapshot.
- **Fork** — create from any point under a **new name**, resources editable in
  the dialog. Lineage goes in tags (`kitchen-forked-from`).
- **Forget** — drop the row and delete that sandbox's point images.

## Retention

TTL is chosen at snapshot time and cannot be changed afterwards, so the UI
never asks for a number:

| Class | TTL | Tag |
|---|---|---|
| Automatic (on stop) | workspace policy, default 30 days | `a30d.r2.<stamp>` |
| Kept (named, or "Keep"-ed later) | `null` — held until deleted | `keep.r2.<stamp>.<label>` |

- The policy is one setting (7 / 30 / 90 days / forever), not a per-snapshot
  question — the storage sits on the user's own Modal account, so it deserves
  exactly one visible knob.
- **Keep** promotes an automatic point by deriving a TTL-free layer (2.4s).
  This is the escape hatch that makes an immutable TTL safe. It was called
  "Pin" at first, which implied precedence — people reasonably assumed a
  pinned point became the one Start uses. "Keep" says what actually happens:
  the point stops expiring, and nothing else changes.
- **Keeping a point preserves its captured-state stamp.** Points are ordered
  by when the machine state was captured, not when the tag was published, so
  keeping an old point does not make it the newest and silently change what a
  plain Start boots. (Ordering by publish time was a real bug; the tag's stamp
  field is now the ordering key, with `publishedAt` kept separately because
  Modal measures the TTL from image creation.)
- TTLs cannot be read back, so the chosen **duration is encoded in the tag**
  and expiry is computed from `createdAt`. Encoding the duration rather than
  just the class keeps old points truthful after the policy changes.
- With the policy set to *forever*, expiry disappears from the UI entirely:
  such points are written as `keep` with no label, since "keep" means exactly
  "no expiry" regardless of how it was chosen.

## Naming

The product says **snapshot** everywhere — in the UI, the API (`/api/snapshots`),
the types (`Snapshot`) and the tag prefix (`kitchen-snap-`). It briefly said
"restore point", which is a blanket term for something people already have a
word for: anyone using sandboxes knows what a snapshot is.

## Where the controls live

- **Naming** — the create drawer opens with a suggestion
  (`sb-stable-scarlet-dragonfly`, from `unique-names-generator`'s adjective /
  colour / animal dictionaries) and a reshuffle button, so a sandbox never
  needs naming to get started. Names are readable rather than hashed because
  the name *is* the identity snapshots hang off; three words can exceed
  the 32-character limit, so generation retries and falls back to two.
- **Row chip** — a sandbox with points shows `N points`; clicking it opens the
  drawer. This is the discoverable path to time travel, rather than hiding it
  behind a menu.
- **Session bar** — `Save point` captures the machine *without stopping it*,
  and `Points…` opens the same drawer from inside the sandbox. Saving mid-work
  is the one mitigation the user can apply themselves for a sandbox that later
  dies unattended.
- **Running sandbox** — `Restore…` rewinds it in place: it stops the sandbox
  and starts it again from the chosen point, with "save the current state as a
  new point first" checked by default. From a session, the restored machine is
  a new sandbox id, so the console follows it.
- **Stopped sandbox** — `Start` (the newest point) or `Start from here` (any
  older one).
- **Any point** — `Fork…` branches into a separate sandbox and leaves this one
  alone; `Keep` stops expiry; `Delete` removes it.

## What Start uses

- A plain **Start** boots the newest point. The drawer marks it `NEXT START`
  (or `NEWEST` while the sandbox is running) so this is never a guess.
- **Start from here** boots any older point. Nothing is saved by starting, so
  the same point can be returned to repeatedly.
- Work then continues from wherever you started: **Stop and save** writes a new
  newest point, so the next plain Start uses that; **Discard changes and stop**
  writes nothing, so the next plain Start uses the same point again.
- A kept point is therefore a bookmark you can always return to, never a new
  default.

## Runtime updates

A snapshot freezes the image layer, so binary versions (ttyd, caddy,
code-server, agent CLIs) are whatever they were when the point was taken. The
boot script is passed at create time, not baked, so configuration fixes
(Caddyfile, MOTD, zsh, herdr seeding) reach restored sandboxes immediately.

Snapshots therefore record the runtime version (`r<n>`). A sandbox
restored onto an older runtime **boots as-is** — fast and predictable — and the
UI offers an explicit *Rebuild runtime* action, because re-layering
`runtimeCommands` onto a snapshot rebuilds the ttyd compile and costs minutes.
Silent multi-minute starts would be a worse default than a visible hint.

## The cost, stated plainly

Anything written since the last snapshot dies with an unattended sandbox,
and our 24h maximum lifetime means every sandbox eventually ends that way.
Mitigations, honestly bounded:

- Stopping is cheap (0.7–9.3s), so "stop when done" is a reasonable habit.
- A snapshot on tab close / visibility change, and periodic points while the
  console is open — which is when work is actually happening, since the panes
  *are* the console.
- A pre-timeout point at ~23h, driven by the open tab.
- A server-side cron can only cover env-var deployment mode: with BYO tokens
  the server holds no credentials once the browser is gone. That limit is
  structural and belongs in the UI, not in a footnote.

The exposed case is a closed laptop with an overnight build. Git is
preinstalled; a volume mounted at `/workspace` is the opt-out for anyone who
wants continuous durability instead.

## Measured end to end

Against a real machine carrying jq (apt), a Rust toolchain in `~/.cargo`,
a global npm package, a `/workspace` file and a `~/.gitconfig`:

| Operation | Time |
|---|---|
| Build a brand new sandbox (runtime image, incl. ttyd compile) | 78s |
| Stop and save (snapshot ~1.3 GB of toolchain + publish + terminate) | **4.3s** |
| Start from the newest snapshot | **1.0s** |
| Fork to a new name on different hardware | **0.9s** |
| Pin an automatic point (derive TTL-free image) | 3.7s |
| Discard changes and stop (no snapshot) | 0.5s |

After a restore: apt packages, `cargo` (compiles), global npm binaries,
`/workspace`, `~/.gitconfig` all intact, and all four panes ready. Starting
from an *older* point dropped a later breakage while keeping the toolchain —
time travel over the machine, code included.

## What the browser has to remember

Modal answers most questions, so localStorage holds only what it cannot:

| Key | Why it cannot be server-side |
|---|---|
| `kitchen-modal-credentials` | the whole BYO-token model; deployment mode replaces it with env vars |
| `kitchen-sandboxes:<workspace>` → `spec` | a stopped sandbox's shape. Sandbox tags die with the sandbox, an image tag cannot hold an image reference or a mount path, and the JS SDK has no Dict and no named `secrets.fromObject`. This is *the* reason stopped rows are browser-local |
| `kitchen-sandboxes:<workspace>` → `op`, `error` | in-flight operation state, so a launch survives a reload |
| `kitchen-deleted-points:<workspace>` | Modal has no unpublish, so deleted points must be filtered locally |
| `kitchen-settings` | retention policy for new points |

What was **removed** by asking Modal instead: the stored `createdAt`, and
`stoppedAt` in the common case — a sandbox's last-stopped time is the capture
time of its newest snapshot, which is server-side and true in every
browser. The same request returns each sandbox's point count for the row chip.
Deleted-point records are pruned once Modal stops listing the tag at all.

localStorage stays the right store: this is a few kilobytes of small values
with no blobs, no queries and no need for transactions, and the synchronous
read is what lets `load` and reactive code use it directly. IndexedDB would
add async plumbing for no gain — revisit only if per-sandbox artifacts (logs,
large point histories) ever get cached client-side.

## Environment containment

Everything lives in the environment configured in Settings — app, sandboxes,
volumes, and snapshot images. The client carries it as its default, and
every call that accepts an environment is passed it explicitly so containment
is visible at the call site.

One trap, found the hard way: the raw `imageListTags` RPC does **not** inherit
the client's environment. An empty `environmentName` resolves to the
*workspace* default, which for an environment-scoped token is
`PERMISSION_DENIED: does not have read access to environment main` — a failed
read of the wrong environment, not a write into it. Verified with an
environment-scoped token that published images land only in that environment.

## When every snapshot is gone

Deleting a point removes its image but not its tag, so a sandbox whose points
have all been deleted (or have expired) still *looks* like it has state to
return to. Resolving the newest tag then fails at `SandboxCreate`, which used
to leave the row permanently failed with a Retry that could never work.

Starting now walks the points newest-first and skips any whose image Modal no
longer has. Three outcomes:

- **A point works** — normal start, nothing to report.
- **No point ever existed** (a brand new name) — build the runtime and start.
  This is the ordinary first launch.
- **Points existed but none survive** — stop and say so, rather than quietly
  handing back an empty machine under a familiar name. The row explains that
  the saved state is gone and offers **Start fresh**, which builds a new
  machine from the base image. That is a deliberate second click: silently
  starting empty invites someone to keep working in a sandbox they believe
  holds their files.

The browser also forgets that sandbox's tags at that moment — a start proved
they are all dead — so the row stops advertising points it cannot use.

## Known rough edges

- **Ghost tags.** There is no unpublish. A deleted point's tag still lists and
  still resolves; only `SandboxCreate` fails. Deletions are recorded in
  localStorage so the list stays clean in the browser that deleted them, and a
  start that fails with "no longer available" hides that point too, so the list
  self-heals across browsers. A tombstone-revision scheme would fix this
  server-side later.
- **Kept twins.** Keeping a point leaves the expiring original published. The
  listing collapses that automatic twin so one state is one row, but never
  collapses two *named* keeps at the same state — those are two deliberate
  bookmarks.
- **Pin durability.** A pinned point booted fine with its parent image both
  expired *and* explicitly deleted, data intact — so Modal reference-counts
  layer data and the cheap 2.4s pin is sound. Whether a much longer horizon
  changes that is still unproven; the fallback would be to boot the point and
  re-snapshot with `ttlMs: null`.
- **Inter-snapshot dedup is unmeasured.** Docs describe snapshots as diffs
  from the *base* image, so N points of a large toolchain may cost N×. Forks
  demonstrably stack on shared parent layers. Until measured, default
  retention stays modest.
- **Snapshot call budget** defaults to 55s; very large filesystems need a
  larger `timeoutMs`, and are a reason to steer big data onto a volume.

## Migration from the volume design

Nothing breaks: running sandboxes are untouched, and the `kitchen-state` volume
still exists with all its data. A sandbox restarted under the new runtime gets
a plain `/workspace` and no longer consults `/kitchen-state`.

Recovering old state needs no migration code — the optional-volume feature *is*
the migration path: mount `kitchen-state` at `/old-state` and copy across.

## Sequencing

1. Runtime + boot script: drop the volume plumbing, plain `/workspace`, stamp
   `RUNTIME_VERSION`, rewrite the MOTD and the in-sandbox `kitchen` command.
2. Snapshot module: tag encode/parse, list, snapshot-and-publish, resolve,
   pin.
3. Stop path: snapshot → publish → terminate, streamed onto the row; plus
   "discard changes and stop".
4. Start path: newest point, a chosen point, or base image; `fromPoint` makes
   fork the same code path under a different name.
5. UI: restore-point drawer (age, expiry, pin, fork, start-from), fork dialog
   with editable resources, retention setting.
Steps 1–5 are done. Still open, in rough order of value:

6. Periodic and tab-close automatic points, which is what shrinks the
   unattended-death window from "since the last stop" to "a few minutes".
7. Mount-beside-live-work at `/restore/<label>`, using the verified
   `mountImage` — cherry-pick a file from an old point without rolling back.
8. Rebuild-runtime action for a sandbox restored onto an older `r<n>`.
9. Tag-based discovery of stopped sandboxes, which would finally make
   localStorage non-load-bearing (needs the spec in the tag, or a tombstone
   scheme for ghosts).
