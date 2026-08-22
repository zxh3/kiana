# Proposal: filesystem snapshots instead of state volume mounts

Status: **proposal** (not implemented). Measurements below are from real probes
against `cheonghiuwaa` on 2026-08-22 with the `modal` JS SDK 0.9.0.

## The question

Today a sandbox's persistence is a single shared volume (`qook-state`, subPath
`sandboxes/<name>`) plus a boot script that drags every interesting path onto
it — symlinks for `/workspace`, herdr's three directories, code-server's User
and extensions dirs, `~/.pi`; env redirections for `CLAUDE_CONFIG_DIR`,
`CODEX_HOME`, `CARGO_HOME`, `RUSTUP_HOME`, `NPM_CONFIG_PREFIX`, `HISTFILE`.
Thirteen entries in `builtinMounts`, surfaced in two places in the UI.

The flaw is not the complexity, it is the **coverage**. That list is an
allowlist: `apt-get install jq`, `pip install`, `~/.gitconfig`, `~/.ssh`, a
patched `/etc/hosts` — none of it survives, and every new tool needs a new
special case. The `qook` MOTD has to explain a rule with thirteen exceptions.

Filesystem snapshots invert this: capture the whole machine, and let the volume
carry only what must never be lost.

## What the API actually offers

The JS SDK has first-class support (`sandbox.snapshotFilesystem()` returns an
`Image`), so this needs no raw gRPC:

```ts
const image = await sandbox.snapshotFilesystem({ ttlMs: null }); // null = keep forever
await image.publish(`qook-snap-${name}:${RUNTIME_VERSION}`);    // durable, server-side pointer
const restored = await client.images.fromName(`qook-snap-${name}:${RUNTIME_VERSION}`);
await client.sandboxes.create(app, restored, { ... });          // ordinary create
```

Verified behaviour:

| Property | Result |
|---|---|
| Snapshot of a small diff | **0.7–2.1s** |
| Snapshot of a 1.3 GB Rust toolchain | **9.3s** |
| Create from a snapshot | **0.2s** (+~2s first-exec lazy pull) |
| `apt-get install` survives | yes — binary, dpkg database, runs after restore |
| Volume-mounted paths | **excluded** from the snapshot entirely |
| Memory, processes, connections | excluded (docs); restored sandbox boots fresh |
| Retention | 30 days by default, **`ttlMs: null` keeps it indefinitely** |
| Layering new image commands onto a snapshot | works (4.3s) — keeps old state, gains new layer |
| Listing published snapshots | `imageListTags({tagPrefix})` → tag, imageId, createdAt |
| Deleting a snapshot | `images.delete(imageId)` works; the **tag string lingers** |

## Proposed design

Two layers with two different durability promises, and one honest sentence for
each.

| Layer | Contents | Promise |
|---|---|---|
| Volume `qook-state`, subPath `sandboxes/<name>/workspace`, mounted **directly at `/workspace`** | the user's code and data | saved continuously, never expires |
| Snapshot image `qook-snap-<name>` | the rest of the machine: apt/pip/npm packages, toolchains, agent logins, shell history, vscode extensions, dotfiles, `/etc` | saved when the sandbox stops |
| Base image + `runtimeCommands` | ttyd, caddy, code-server, herdr, zsh, agent CLIs | rebuilt when `RUNTIME_VERSION` changes |

The volume stops being a state-plumbing mechanism and becomes just the work
directory. `/qook-state` disappears as a concept.

### Lifecycle

- **Create (new name)** — as today: base image + `runtimeCommands`, volume at
  `/workspace`. No snapshot exists yet.
- **Stop** — `snapshotFilesystem({ttlMs: null})` → `publish("qook-snap-<name>:<RUNTIME_VERSION>")`
  → `terminate()` → delete the previous snapshot image. The existing
  `Stopping…` row gains a `saving machine state` phase; the streamed-phase
  machinery from the launch rework already covers this.
- **Start** — resolve `qook-snap-<name>:<RUNTIME_VERSION>`; if found, create
  from it. If only an older runtime tag exists, layer the current
  `runtimeCommands` on top of it (verified: 4.3s, keeps state) and republish
  under the new tag. If nothing resolves, fall back to base + runtime — the
  machine layer is gone but `/workspace` is untouched.
- **Forget** — delete the snapshot image; optionally the volume subPath.

### What this deletes

- Every symlink and env redirection in `bootScript` (herdr dirs, code-server
  dirs, `~/.pi`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `CARGO_HOME`,
  `RUSTUP_HOME`, `NPM_CONFIG_PREFIX`, `HISTFILE`). Tools live where they
  normally live.
- `builtinMounts` (13 entries) and its two UI surfaces — the drawer's
  "12 more paths persist" expander and the table popover's BUILT-IN section —
  collapse to one row: `/workspace`.
- The `qook` command's persists/doesn't-persist table and its Rust
  special-case detection.
- `/qook-state` as a reserved path; only `/workspace` stays reserved.

### What the UI must now say

Two promises instead of one rule with exceptions:

> `/workspace` is saved continuously. Everything else you install or configure
> is saved when you stop the sandbox.

## Risks, honestly

1. **A sandbox that dies without a Stop loses its machine layer.** The 24h
   timeout, a crash, or a boot-script exit takes no snapshot; the next start
   falls back to the last snapshot (or the base image). `/workspace` is always
   safe. Mitigations, in order of cost: a manual "Save machine state" item in
   the session menu (cheap, honest); a periodic auto-snapshot driven by a
   scheduled Modal function in `deploy.py` (we already deploy on Modal, so this
   is a natural home); nothing else needed.
2. **Snapshot-time cost on Stop** — 1–10s depending on how much was installed.
   Acceptable, and now visible in the UI rather than hidden.
3. **Files mid-write are captured mid-write.** `sync` before snapshotting; the
   services are restarted by the boot script anyway, and herdr already restores
   its sessions from its own files.
4. **Runtime drift** — a restored snapshot freezes the image layer, so fixes
   like today's ttyd clipboard build would never reach it. Handled by tagging
   snapshots with `RUNTIME_VERSION` and re-layering on mismatch. This must be
   built in from the start, or restored sandboxes silently rot.
5. **Storage** — one image diff per stopped sandbox, deleted when superseded.
   Note the docs' caveat: deleting an image does not delete intermediate
   layers.
6. **Dangling tags** — there is no unpublish RPC, so a deleted snapshot leaves
   its tag string listed. Any discovery-by-tag must treat the list as a hint
   and tolerate a `NotFoundError` at create time.

## Bonus: stopped rows could stop being browser-local

`imageListTags({tagPrefix: "qook-snap-"})` enumerates snapshots from Modal, so
stopped sandboxes become discoverable server-side instead of living only in
this browser's localStorage — they would survive cleared storage and appear in
a second browser. Given risk 6, localStorage should stay the primary row source
and the tag list a supplement. Worth doing, but separable.

## What I would not do yet

`sandbox.snapshotFilesystem` is the stable, documented path. The memory+
filesystem snapshot (`_experimental_snapshot` / `SandboxSnapshot` /
`sandboxRestore`) would additionally restore *running processes* — live shells,
a running dev server — which is tempting. But it is an early-preview API,
needs `enableSnapshot: true` at create, pins the gVisor version, restores only
onto the same instance type, and GPU snapshotting is alpha. herdr already
restores its sessions from disk, which covers most of the benefit. Revisit
later; `sandboxRestore` even takes `replaceVolumeMounts`, so the volume split
proposed here stays compatible.

## Suggested sequencing

1. Runtime + boot script: volume directly at `/workspace`, delete the symlink
   and env-redirection plumbing, stamp `RUNTIME_VERSION` into the image.
2. Stop path: snapshot → publish → terminate, with the phase surfaced on the
   row; prune the superseded image.
3. Start path: resolve tag → create; re-layer on runtime mismatch; fall back to
   base image when nothing resolves.
4. UI/copy: collapse `builtinMounts`, rewrite the MOTD and `qook` command
   around the two promises.
5. Optional: manual "Save machine state"; scheduled auto-snapshot; tag-based
   discovery of stopped sandboxes.

Existing sandboxes are unaffected by 1–4 in the sense that nothing breaks, but
their `/qook-state` contents (agent logins, toolchains, herdr history) would no
longer be consulted. A one-off migration could copy
`qook-state/sandboxes/<name>/workspace` to the new subPath layout — or, since
the old and new `/workspace` subPath can be made identical, skip migration
entirely and simply let the non-workspace state go.
