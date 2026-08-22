# Snapshots as the native persistence model

(The product was renamed **kitchen** on 2026-08-22; earlier notes calling it
qook refer to the same thing.)

Status: **implemented**. Every measurement and API claim below was verified
against `cheonghiuwaa` with the `modal` JS SDK 0.9.0 on 2026-08-22.

## The model

A kitchen sandbox **is its filesystem**. Persistence is not a set of paths wired
onto a volume — it is a chain of **restore points**, each one a published
Modal image captured from the sandbox's own filesystem.

```
kitchen-snap-<sandbox>:<retention>.r<runtime>.<stamp>[.<label>]
```

Volumes remain, but only as an **explicit user choice**: mount one when you
want continuous durability, data shared live between sandboxes, or something
too large to belong in a restore point.

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
out of my restore points" tool.** One feature, two jobs, no new concepts.

## Verified behaviour

| Property | Result |
|---|---|
| Snapshot, small diff | 0.7–2.1s |
| Snapshot, 1.3 GB Rust toolchain | **9.3s** |
| Create from a restore point | 0.2s (+~2s first-exec lazy pull) |
| `apt-get install` survives | yes — binary, dpkg database, runs after restore |
| Volume-mounted paths | excluded from snapshots entirely |
| Memory / processes / connections | excluded; a restored sandbox boots fresh |
| `ttlMs: null` | retains the image indefinitely |
| Expiry | distinguishable error: `NOT_FOUND: Image '…' has expired` |
| Extending a TTL | impossible — but `dockerfileCommands(["RUN true"]).build()` yields a **TTL-free** image in 2.4s that survives its parent's expiry *and its parent's deletion*, data intact |
| Layering the current runtime onto a snapshot | works (4.3s in a probe): keeps state, gains the new layer |
| Listing restore points | `imageListTags({tagPrefix})` → tag, imageId, createdAt |
| Deleting an image | works; the **tag string lingers** and still resolves — only `SandboxCreate` reports `NOT_FOUND` |
| Tag charset | alphanumerics, dashes, periods, underscores; spaces rejected |
| `mountImage(path, image)` | mounts a restore point into a *running* sandbox; read, diff, `cp` back, `unmountImage` |
| Container-managed files | `/etc/hosts`, `/etc/resolv.conf` are rewritten at boot and do **not** survive; the rest of `/etc` does |

## Lifecycle

- **Create (new name)** — base image + `runtimeCommands`; `/workspace` is a
  plain directory in the image.
- **Start (name has restore points)** — create from the newest point, or from
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

A restore point freezes the image layer, so binary versions (ttyd, caddy,
code-server, agent CLIs) are whatever they were when the point was taken. The
boot script is passed at create time, not baked, so configuration fixes
(Caddyfile, MOTD, zsh, herdr seeding) reach restored sandboxes immediately.

Restore points therefore record the runtime version (`r<n>`). A sandbox
restored onto an older runtime **boots as-is** — fast and predictable — and the
UI offers an explicit *Rebuild runtime* action, because re-layering
`runtimeCommands` onto a snapshot rebuilds the ttyd compile and costs minutes.
Silent multi-minute starts would be a worse default than a visible hint.

## The cost, stated plainly

Anything written since the last restore point dies with an unattended sandbox,
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
| Start from the newest restore point | **1.0s** |
| Fork to a new name on different hardware | **0.9s** |
| Pin an automatic point (derive TTL-free image) | 3.7s |
| Discard changes and stop (no snapshot) | 0.5s |

After a restore: apt packages, `cargo` (compiles), global npm binaries,
`/workspace`, `~/.gitconfig` all intact, and all four panes ready. Starting
from an *older* point dropped a later breakage while keeping the toolchain —
time travel over the machine, code included.

## Environment containment

Everything lives in the environment configured in Settings — app, sandboxes,
volumes, and restore-point images. The client carries it as its default, and
every call that accepts an environment is passed it explicitly so containment
is visible at the call site.

One trap, found the hard way: the raw `imageListTags` RPC does **not** inherit
the client's environment. An empty `environmentName` resolves to the
*workspace* default, which for an environment-scoped token is
`PERMISSION_DENIED: does not have read access to environment main` — a failed
read of the wrong environment, not a write into it. Verified with an
environment-scoped token that published images land only in that environment.

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
