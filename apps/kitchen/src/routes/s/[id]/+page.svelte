<script lang="ts">
import { DropdownMenu } from "bits-ui";
import { goto, invalidate, replaceState } from "$app/navigation";
import { page } from "$app/state";
import { api } from "$lib/api";
import SnapshotsDrawer from "$lib/components/SnapshotsDrawer.svelte";
import { formatResources, formatUptime } from "$lib/format";
import { bindHotkeys, displayKeys, PALETTE_KEY } from "$lib/hotkeys";
import { launch, saveSnapshotNow, stop } from "$lib/launch";
import { sandboxUrl } from "$lib/modalLinks";
import { palette } from "$lib/palette.svelte";
import { RUNTIME_VERSION } from "$lib/runtimeVersion";
import { shortcutsPanel } from "$lib/shortcutsPanel.svelte";
import { visibleSnapshots } from "$lib/snapshots";
import {
  modePorts,
  type OpPhase,
  opPhaseLabels,
  type SessionMode,
  type Snapshot,
  sessionModes,
} from "$lib/types";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

// Mode switching is pure client state so the pane iframes never remount —
// remounting would sever the terminal's WebSocket and spawn a fresh shell.
// Panes mount lazily on first visit, then stay alive but hidden.
const requested = page.url.searchParams.get("mode");
const initialMode: SessionMode = sessionModes.includes(requested as SessionMode)
  ? (requested as SessionMode)
  : "zsh";
let mode = $state<SessionMode>(initialMode);
let visited = $state<Record<string, boolean>>({ [initialMode]: true });
let actionError = $state<string | null>(null);

// Snapshots, from inside the sandbox. Saving here is the whole reason:
// a sandbox killed unattended keeps only what its last snapshot holds, and this
// is the one moment the user is present to say "capture this".
let snapshotsOpen = $state(false);
let saving = $state<OpPhase | null>(null);
let savedAt = $state<string | null>(null);
/** How many snapshots this sandbox has; null until the first fetch answers. */
let snapshotCount = $state<number | null>(null);

/**
 * Safari refuses the pane cookie.
 *
 * Each pane is an iframe on the sandbox's own tunnel host, so the cookie Caddy
 * sets during /kitchen-auth is a third-party cookie. Safari blocks those by
 * default (Prevent cross-site tracking), the redirected request arrives without
 * it, and the pane answers "kitchen: authentication required". Chrome still
 * allows SameSite=None third-party cookies, which is why it works there.
 *
 * Opening the pane as a top-level tab makes the same cookie first-party, so it
 * works — that is the honest workaround until panes are proxied same-origin.
 */
const safari =
  typeof navigator !== "undefined" &&
  /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(
    navigator.userAgent,
  );
let cookieNoteDismissed = $state(false);

/**
 * Panes that have finished loading.
 *
 * A ready pane is not an instant pane: code-server in particular takes a
 * second or two to paint, and until then the area is simply black. The iframe
 * stays mounted across mode switches, so this is tracked per mode.
 */
let paneLoaded = $state<Record<string, boolean>>({});

function openPaneTab() {
  // For the browser pane, keep whatever path was navigated to rather than
  // dropping the user back at the app's root.
  const url =
    mode === "browser"
      ? (browserSrc ?? data.session?.panes.browser?.url)
      : data.session?.panes[mode]?.url;
  if (url) window.open(url, "_blank");
}
const workspace = $derived(page.data.connection?.workspace ?? "default");
const connection = $derived(page.data.connection ?? null);

/**
 * Whether a pane currently holds the keyboard.
 *
 * A pane is a cross-origin iframe: while it has focus the parent document
 * receives no key events at all, so none of the console's shortcuts can fire.
 * Nothing can change that — but the console can stop pretending otherwise and
 * say where the keyboard went. Clicking anything in the bar takes it back.
 */
let paneHasFocus = $state(false);
$effect(() => {
  const check = () =>
    (paneHasFocus = document.activeElement?.tagName === "IFRAME");
  const t = setInterval(check, 700);
  window.addEventListener("focusin", check);
  return () => {
    clearInterval(t);
    window.removeEventListener("focusin", check);
  };
});

function switchMode(m: SessionMode) {
  visited[m] = true;
  mode = m;
  replaceState(`?mode=${m}`, {});
}

// Digits switch panes: Mod+1..4 would be the convention, but browsers keep
// that for their own tabs. These only arrive when focus is outside the pane.
$effect(() =>
  bindHotkeys([
    ["1", () => switchMode("zsh")],
    ["2", () => switchMode("herdr")],
    ["3", () => switchMode("vscode")],
    ["4", () => switchMode("browser")],
    ["S", () => void saveNow()],
    ["B", () => void goto("/")],
  ]),
);

let now = $state(Date.now());
// A pane that is still booting gets a per-second clock, so the wait is
// visibly progressing rather than an indefinite spinner.
const paneReady = $derived(data.session?.panes[mode]?.ready ?? true);
$effect(() => {
  const t = setInterval(() => (now = Date.now()), paneReady ? 30_000 : 1000);
  return () => clearInterval(t);
});

// Seconds spent waiting for the current pane, reset whenever it starts booting.
let waitStart = $state(Date.now());
$effect(() => {
  if (!paneReady) waitStart = Date.now();
});
const waited = $derived(paneReady ? 0 : Math.round((now - waitStart) / 1000));
const waitedLabel = $derived(waited > 2 ? `${waited}s` : "");

// The sandbox can end on its own — re-check every 30s while visible.
$effect(() => {
  if (!data.session) return;
  const t = setInterval(() => {
    if (document.visibilityState === "visible") invalidate("app:session");
  }, 30_000);
  return () => clearInterval(t);
});

// While any pane's service is still coming up, poll fast until it answers.
$effect(() => {
  if (!data.session) return;
  if (Object.values(data.session.panes).every((p) => p.ready)) return;
  const t = setInterval(() => {
    if (document.visibilityState === "visible") invalidate("app:session");
  }, 3_000);
  return () => clearInterval(t);
});

// Browser pane controls. The iframe is cross-origin, so its current URL is
// unreadable and true back/forward can't be driven from here — what works:
// navigating to a path (the auth cookie is already set after first load),
// reloading (remount via key), and opening the tunnel in a real tab.
let browserPath = $state("/");
let browserSrc = $state<string | null>(null);
let browserReload = $state(0);

function browserOrigin(): string | null {
  const url = data.session?.panes.browser?.url;
  return url ? new URL(url).origin : null;
}

function browserGo(event: SubmitEvent) {
  event.preventDefault();
  const origin = browserOrigin();
  if (!origin) return;
  const path = browserPath.trim().startsWith("/")
    ? browserPath.trim()
    : `/${browserPath.trim()}`;
  browserPath = path;
  browserSrc = origin + path;
  browserReload++;
}

async function refreshCount() {
  if (!sb) return;
  try {
    const { snapshots } = await api<{ snapshots: Snapshot[] }>(
      `/api/snapshots?sandbox=${encodeURIComponent(sb.name)}`,
    );
    snapshotCount = visibleSnapshots(snapshots).length;
  } catch {
    // the count is decoration; the drawer reports real failures
  }
}

$effect(() => {
  if (sb) void refreshCount();
});

async function saveNow() {
  if (saving) return;
  actionError = null;
  savedAt = null;
  saving = "snapshotting";
  const result = await saveSnapshotNow(data.id, {}, (phase: OpPhase) => {
    saving = phase;
  });
  saving = null;
  if (result.ok) {
    savedAt = result.snapshot.label || "saved";
    await refreshCount();
  } else {
    actionError = result.error;
  }
}

/** Stop from inside the session; the table is where stopped sandboxes live. */
async function stopHere(save: boolean) {
  if (!sb) return;
  actionError = null;
  saving = save ? "snapshotting" : "stopping";
  await stop(
    workspace,
    data.id,
    sb.name,
    sb,
    { save },
    { onPhase: (phase: OpPhase) => (saving = phase) },
  );
  saving = null;
  await goto("/");
}

/**
 * Rewind this sandbox to an earlier snapshot. The restored machine is a new
 * sandbox with a new id, so follow it rather than leaving a dead session open.
 */
async function restoreTo(snapshot: Snapshot, saveFirst: boolean) {
  if (!sb) return;
  actionError = null;
  saving = saveFirst ? "snapshotting" : "stopping";
  await stop(
    workspace,
    data.id,
    sb.name,
    sb,
    { save: saveFirst },
    { onPhase: (phase: OpPhase) => (saving = phase) },
  );
  saving = "creating";
  await launch(
    workspace,
    sb,
    { onPhase: (phase: OpPhase) => (saving = phase) },
    { fromSnapshot: snapshot.tag },
  );
  saving = null;
  // The table resolves the new sandbox and its session link.
  await goto("/");
}

function forkFrom(snapshot: Snapshot) {
  if (!sb) return;
  void launch(
    workspace,
    { ...sb, name: `${sb.name}-fork` },
    {},
    { fromSnapshot: snapshot.tag, forkedFrom: snapshot.tag },
  );
  void goto("/");
}

const sb = $derived(data.session?.sandbox ?? null);
</script>

<svelte:head>
	<title>{sb?.name ?? 'sandbox'} · kitchen</title>
</svelte:head>

<div class="flex h-screen flex-col">
	{#if !data.session || !sb}
		<div class="flex flex-1 flex-col items-center justify-center gap-4">
			<p class="text-body max-w-[420px] text-center text-[12.5px] leading-[1.6]">
				This sandbox is no longer running. Create one with the same name to resume its
				/workspace.
			</p>
			<a
				href="/"
				class="bg-accent text-canvas cursor-pointer rounded-[7px] px-4 py-[10px] text-[12.5px] font-semibold"
			>
				Back to sandboxes
			</a>
		</div>
	{:else}
		<!--
			Session bar: one 46px row, read left to right as
			  which sandbox → which view of it → what it costs → what to do with it.

			The pane switcher sits directly after the name because it belongs to
			it: these are views of this sandbox. It used to be centred between two
			flex spacers, which meant its position depended on the width of
			everything around it — so it drifted rightward as the uptime grew from
			"0m" to "29m" and sat somewhere different for every sandbox name.
			Anchoring it to the name keeps it still while you use it, and the
			mutable numbers moved right, where nothing depends on their width.
		-->
		<header
			class="flex h-[46px] flex-none items-center gap-3 overflow-x-auto border-b border-white/8 px-4"
		>
			<a
				href="/"
				class="text-body flex size-[26px] flex-none items-center justify-center rounded-md border border-white/12 text-xs hover:bg-white/5"
				aria-label="Back to sandboxes"
			>
				←
			</a>
			<!-- flex-none: the row scrolls when it is tight, it does not squeeze
			     the name away. max-w truncates only genuinely long names. -->
			<span
				class="max-w-[220px] flex-none truncate font-mono text-[13px] leading-none font-semibold"
				title={sb.name}
			>
				{sb.name}
			</span>

			<span class="h-[18px] w-px flex-none bg-white/10"></span>

			<!--
				Mode switcher (client-side: panes stay mounted across switches).
				Readiness lives on the pane's own button — a row of bare port
				numbers asked people to know which port meant which pane, and the
				port is not the thing anyone is looking for. The number is still
				there on hover for whoever wants it.
			-->
			<div class="flex flex-none items-center gap-[2px] rounded-[7px] border border-white/10 p-[3px]">
				{#each sessionModes as m (m)}
					{@const ready = data.session.panes[m].ready}
					<button
						type="button"
						onclick={() => switchMode(m)}
						title="{m} · port {modePorts[m]} · {ready ? 'ready' : 'starting'}"
						class="flex cursor-pointer items-center gap-[6px] rounded-[5px] px-[11px] py-[6px] font-mono text-[11.5px] leading-none font-medium
							{mode === m
							? 'text-ink bg-white/8'
							: 'text-body hover:text-control hover:bg-white/4'}"
					>
						<span
							class="size-[5px] flex-none rounded-full {ready
								? 'bg-running'
								: 'bg-stopped animate-pulse'}"
						></span>
						{m}
					</button>
				{/each}
			</div>

			<div class="flex-1"></div>

			<span
				class="flex flex-none items-center gap-[6px] text-[11px] leading-none font-medium whitespace-nowrap text-[#8fe0b2]"
			>
				<span class="bg-running halo-running size-[5px] rounded-full"></span>
				Running · {formatUptime(sb.createdAt, now)}
			</span>
			<span class="text-muted flex-none font-mono text-[11px] whitespace-nowrap">
				{formatResources(sb)}
			</span>

			<span class="h-[18px] w-px flex-none bg-white/10"></span>

			<button
				type="button"
				onclick={() => (palette.open = true)}
				title="Search sandboxes and actions ({displayKeys(PALETTE_KEY)})"
				aria-label="Command palette"
				class="text-secondary hover:text-control flex flex-none cursor-pointer items-center
					justify-center rounded-md border border-white/12 px-[7px] py-[6px] font-mono
					text-[10.5px] leading-none hover:bg-white/5"
			>
				{displayKeys(PALETTE_KEY)}
			</button>

			<button
				type="button"
				onclick={() => (shortcutsPanel.open = true)}
				title={paneHasFocus
					? 'The pane has the keyboard, so shortcuts are asleep — clicking here wakes them'
					: 'Keyboard shortcuts (?)'}
				aria-label="Keyboard shortcuts"
				class="flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-md border font-mono text-[11px]
					{paneHasFocus
					? 'text-faint border-white/8'
					: 'text-secondary hover:text-control border-white/12 hover:bg-white/5'}"
			>
				?
			</button>

			<button
				type="button"
				onclick={openPaneTab}
				aria-label="Open this pane in a new tab"
				title={safari
					? 'Open this pane in a new tab — the only way panes work in Safari'
					: 'Open this pane in a new tab'}
				class="flex flex-none cursor-pointer items-center justify-center rounded-md border text-xs
					{safari
					? 'border-accent/40 text-accent gap-[5px] px-[9px] py-[6px] text-[11.5px] font-medium hover:bg-white/5'
					: 'text-body size-[26px] border-white/12 hover:bg-white/5'}"
			>
				↗{safari ? ' open in tab' : ''}
			</button>

			<!--
				One control, two targets: the action people take often (save now)
				and the list it lands in. A split button keeps saving to one click
				while the count says whether there is anything to go back to.
			-->
			<div
				class="flex flex-none items-stretch overflow-hidden rounded-[6px] border border-white/14"
			>
				<button
					type="button"
					onclick={saveNow}
					disabled={Boolean(saving)}
					title="Save a snapshot of this machine now, without stopping it"
					class="text-control flex cursor-pointer items-center gap-[6px] px-[10px] py-[6px] text-[11.5px] leading-none font-medium whitespace-nowrap hover:bg-white/6 disabled:opacity-60"
				>
					{#if saving}
						<span class="bg-accent size-[5px] animate-pulse rounded-full"></span>
						<span class="text-accent">{opPhaseLabels[saving]}…</span>
					{:else if savedAt}
						<span class="text-running-text">saved</span>
					{:else}
						Save snapshot
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (snapshotsOpen = true)}
					title="Browse this sandbox's snapshots"
					aria-label="Browse snapshots"
					class="text-body flex cursor-pointer items-center gap-[5px] border-l border-white/14 px-[9px] py-[6px] font-mono text-[11px] leading-none whitespace-nowrap hover:bg-white/6"
				>
					{snapshotCount ?? '–'}
					<span class="text-faint text-[8px]">▾</span>
				</button>
			</div>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class="text-body flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-md border border-white/12 text-xs hover:bg-white/5"
					aria-label="Session actions"
				>
					⋯
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						class="bg-overlay shadow-overlay z-50 min-w-[190px] rounded-[9px] border border-white/12 p-[5px]"
						sideOffset={6}
						align="end"
					>
						{#if connection}
							{@const link = sandboxUrl(
								connection.workspace,
								connection.environment,
								data.id,
							)}
							<DropdownMenu.Item
								class="text-control data-highlighted:bg-white/6 flex cursor-pointer items-center gap-[7px] rounded-md px-[9px] py-[9px] text-[12.5px]"
								onSelect={() => window.open(link, '_blank')}
							>
								View in Modal <span class="text-faint text-[9px]">↗</span>
							</DropdownMenu.Item>
							<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
								Logs, the container, and what it is costing.
							</div>
						{/if}
						<DropdownMenu.Item
							class="text-control data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
							onSelect={() => stopHere(true)}
							disabled={Boolean(saving)}
						>
							Stop and save
						</DropdownMenu.Item>
						<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
							Saves the whole machine as a snapshot, then stops it.
						</div>
						<DropdownMenu.Item
							class="text-failed-text data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
							onSelect={() => stopHere(false)}
							disabled={Boolean(saving)}
						>
							Discard changes and stop
						</DropdownMenu.Item>
						<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
							Stops without saving. The last snapshot stays as it was.
						</div>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</header>

		{#if safari && !cookieNoteDismissed}
			<div class="flex-none px-4 pt-3">
				<div
					class="flex items-start gap-3 rounded-lg border border-white/12 bg-white/3 px-4 py-3"
				>
					<span class="bg-stopped mt-[6px] size-[6px] flex-none rounded-full"></span>
					<div class="flex min-w-0 flex-col gap-2">
						<span class="text-body text-xs leading-[1.65]">
							Safari refuses the cookie a pane needs: the pane is an iframe on the sandbox's
							own host, and Safari blocks third-party cookies by default. Panes will say
							<span class="font-mono">authentication required</span> here — Chrome and Edge
							run them inline.
						</span>
						<button
							type="button"
							onclick={openPaneTab}
							class="text-accent border-accent/40 w-fit cursor-pointer rounded-[5px] border px-[10px] py-[5px] text-[11.5px] leading-none font-medium hover:bg-white/5"
						>
							↗ Open this pane in a new tab
						</button>
					</div>
					<button
						type="button"
						onclick={() => (cookieNoteDismissed = true)}
						aria-label="Dismiss"
						class="text-faint hover:text-control ml-auto flex size-[22px] flex-none cursor-pointer items-center justify-center rounded text-[11px]"
					>
						✕
					</button>
				</div>
			</div>
		{/if}

		{#if actionError}
			<div class="px-4 pt-3">
				<div
					class="border-failed/28 bg-failed/6 flex items-center gap-[9px] rounded-lg border px-[13px] py-[11px]"
				>
					<span class="bg-failed size-[6px] shrink-0 rounded-full"></span>
					<span class="text-failed-text text-xs leading-[1.4]">{actionError}</span>
				</div>
			</div>
		{/if}

		{#if mode === 'browser' && data.session.panes.browser.ready}
			<!-- Browser toolbar: path navigation + reload + open in tab -->
			<div class="flex h-[36px] flex-none items-center gap-2 border-b border-white/6 px-3">
				<button
					type="button"
					onclick={() => browserReload++}
					aria-label="Reload"
					title="Reload"
					class="text-body flex size-[24px] cursor-pointer items-center justify-center rounded-[5px] border border-white/10 text-[11px] hover:bg-white/5"
				>
					↻
				</button>
				<form onsubmit={browserGo} class="flex min-w-0 flex-1 items-center gap-2">
					<input
						bind:value={browserPath}
						spellcheck="false"
						autocomplete="off"
						placeholder="/"
						class="focus:border-accent/45 w-0 flex-1 rounded-[5px] border border-white/10 bg-white/2 px-[9px] py-[5px] font-mono text-[11.5px] leading-none focus:outline-none"
					/>
				</form>
				<span class="text-muted font-mono text-[10.5px] whitespace-nowrap">→ :3000</span>
			</div>
		{/if}
		{#each sessionModes as m (m)}
			{#if visited[m] && data.session.panes[m].ready}
				{#if m === 'browser'}
					{#key browserReload}
						<!-- White canvas: unstyled pages assume a browser-default background.
						     sandbox blocks target=_top escapes from navigating the console away. -->
						<iframe
							src={browserSrc ?? data.session.panes.browser.url}
							title="browser — {sb.name}"
							onload={() => (paneLoaded[m] = true)}
							class="min-h-0 w-full flex-1 border-0 bg-white {mode === m ? '' : 'hidden'}"
							allow="clipboard-read; clipboard-write"
							sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
						></iframe>
					{/key}
				{:else}
					<iframe
						src={data.session.panes[m].url}
						title="{m} — {sb.name}"
						onload={() => (paneLoaded[m] = true)}
						class="bg-canvas min-h-0 w-full flex-1 border-0 {mode === m ? '' : 'hidden'}"
						allow="clipboard-read; clipboard-write"
					></iframe>
				{/if}
			{/if}
		{/each}
		{#if data.session.panes[mode].ready && !paneLoaded[mode]}
			<!-- Sits in flow beneath the mounted iframe, which is still blank -->
			<div class="pointer-events-none flex flex-1 items-center justify-center">
				<span class="text-muted flex items-center gap-[9px] text-[12px]">
					<span class="bg-accent size-[5px] animate-pulse rounded-full"></span>
					loading {mode}…
				</span>
			</div>
		{/if}
		{#if !data.session.panes[mode].ready}
			<div class="flex flex-1 flex-col items-center justify-center gap-3">
				<span class="flex items-center gap-[9px]">
					<span class="bg-accent size-[6px] animate-pulse rounded-full"></span>
					<span class="text-body font-mono text-[12.5px]">
						starting {mode}… {waitedLabel}
					</span>
				</span>
				<p class="text-muted max-w-[380px] text-center text-[11.5px] leading-[1.6]">
					{#if waited < 45}
						The sandbox is booting its services.
					{:else}
						Still no answer on port {modePorts[mode]}. Services usually answer within
						half a minute — if this persists, terminate the sandbox and start it again.
					{/if}
				</p>
			</div>
		{/if}
	{/if}
</div>

{#if sb}
	<SnapshotsDrawer
		bind:open={snapshotsOpen}
		sandbox={sb.name}
		spec={sb}
		running={true}
		{workspace}
		runtimeVersion={RUNTIME_VERSION}
		onstart={() => {}}
		onfork={forkFrom}
		onrestore={restoreTo}
	/>
{/if}
