<script lang="ts">
import { DropdownMenu } from "bits-ui";
import { goto, invalidate, replaceState } from "$app/navigation";
import { page } from "$app/state";
import RestorePointsDrawer from "$lib/components/RestorePointsDrawer.svelte";
import { formatResources, formatUptime } from "$lib/format";
import { launch, savePoint, stop } from "$lib/launch";
import { RUNTIME_VERSION } from "$lib/runtimeVersion";
import { loadSettings } from "$lib/settings";
import {
  modePorts,
  type OpPhase,
  opPhaseLabels,
  type RestorePoint,
  type SessionMode,
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

// Restore points, from inside the sandbox. Saving here is the whole point:
// a sandbox killed unattended keeps only what its last point holds, and this
// is the one moment the user is present to say "capture this".
let pointsOpen = $state(false);
let saving = $state<OpPhase | null>(null);
let savedAt = $state<string | null>(null);
const workspace = $derived(page.data.connection?.workspace ?? "default");

function switchMode(m: SessionMode) {
  visited[m] = true;
  mode = m;
  replaceState(`?mode=${m}`, {});
}

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

function browserOpenTab() {
  window.open(browserSrc ?? data.session?.panes.browser?.url, "_blank");
}

async function saveNow() {
  if (saving) return;
  actionError = null;
  savedAt = null;
  saving = "snapshotting";
  const result = await savePoint(
    data.id,
    { retentionDays: loadSettings().retentionDays },
    (phase) => {
      saving = phase;
    },
  );
  saving = null;
  if (result.ok) savedAt = result.point.label || "saved";
  else actionError = result.error;
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
    { save, retentionDays: loadSettings().retentionDays },
    { onPhase: (phase) => (saving = phase) },
  );
  saving = null;
  await goto("/");
}

/**
 * Rewind this sandbox to an earlier point. The restored machine is a new
 * sandbox with a new id, so follow it rather than leaving a dead session open.
 */
async function restoreTo(point: RestorePoint, saveFirst: boolean) {
  if (!sb) return;
  actionError = null;
  saving = saveFirst ? "snapshotting" : "stopping";
  await stop(
    workspace,
    data.id,
    sb.name,
    { save: saveFirst, retentionDays: loadSettings().retentionDays },
    { onPhase: (phase) => (saving = phase) },
  );
  saving = "creating";
  await launch(
    workspace,
    sb,
    { onPhase: (phase) => (saving = phase) },
    { fromPoint: point.tag },
  );
  saving = null;
  // The table resolves the new sandbox and its session link.
  await goto("/");
}

function forkFrom(point: RestorePoint) {
  if (!sb) return;
  void launch(
    workspace,
    { ...sb, name: `${sb.name}-fork` },
    {},
    { fromPoint: point.tag, forkedFrom: point.tag },
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
		<!-- Session bar: one 46px row carries the whole session -->
		<header
			class="flex h-[46px] flex-none items-center gap-[14px] overflow-x-auto border-b border-white/8 px-4"
		>
			<a
				href="/"
				class="text-body flex size-[26px] items-center justify-center rounded-md border border-white/12 text-xs hover:bg-white/5"
				aria-label="Back to sandboxes"
			>
				←
			</a>
			<span class="font-mono text-[13px] leading-none font-semibold whitespace-nowrap">
				{sb.name}
			</span>
			<span
				class="flex items-center gap-[6px] text-[11px] leading-none font-medium whitespace-nowrap text-[#8fe0b2]"
			>
				<span class="bg-running halo-running size-[5px] rounded-full"></span>
				Running · {formatUptime(sb.createdAt, now)}
			</span>
			<span class="text-muted font-mono text-[11px] whitespace-nowrap">{formatResources(sb)}</span>
			<div class="flex-1"></div>

			<!-- Mode switcher (client-side: panes stay mounted across switches) -->
			<div class="flex items-center gap-[2px] rounded-[7px] border border-white/10 p-[3px]">
				{#each sessionModes as m (m)}
					<button
						type="button"
						onclick={() => switchMode(m)}
						class="flex cursor-pointer items-center gap-[7px] rounded-[5px] px-[11px] py-[6px] font-mono text-[11.5px] leading-none
							{mode === m ? 'text-ink bg-white/7 font-medium' : 'text-body hover:text-control'}"
					>
						{#if m === 'zsh'}
							<span class={mode === 'zsh' ? 'text-accent' : 'text-muted'}>&gt;_</span>
						{/if}
						{m}
					</button>
				{/each}
			</div>

			<!-- Forwarded ports -->
			<span
				class="text-secondary flex items-center gap-[9px] font-mono text-[11px] whitespace-nowrap"
			>
				{#each sessionModes as m (m)}
					<span class="flex items-center gap-[5px]">
						<span class="{data.session.panes[m].ready ? 'text-running' : 'text-stopped'} text-[8px]">●</span>{modePorts[m]}
					</span>
				{/each}
			</span>

			<!-- Restore points, without leaving the sandbox -->
			<div class="flex flex-none items-center gap-[6px]">
				{#if saving}
					<span class="text-accent flex items-center gap-[6px] text-[11px] whitespace-nowrap">
						<span class="bg-accent size-[5px] animate-pulse rounded-full"></span>
						{opPhaseLabels[saving]}…
					</span>
				{:else if savedAt}
					<span class="text-running-text text-[11px] whitespace-nowrap">point saved</span>
				{/if}
				<button
					type="button"
					onclick={saveNow}
					disabled={Boolean(saving)}
					title="Save a restore point of this machine now, without stopping it"
					class="text-control cursor-pointer rounded-[5px] border border-white/14 px-[9px] py-[6px] text-[11.5px] leading-none font-medium whitespace-nowrap hover:bg-white/5 disabled:opacity-60"
				>
					Save point
				</button>
				<button
					type="button"
					onclick={() => (pointsOpen = true)}
					title="Browse this sandbox's restore points"
					class="text-body cursor-pointer rounded-[5px] border border-white/12 px-[9px] py-[6px] text-[11.5px] leading-none font-medium whitespace-nowrap hover:bg-white/5"
				>
					Points…
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
						<DropdownMenu.Item
							class="text-control data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
							onSelect={() => stopHere(true)}
							disabled={Boolean(saving)}
						>
							Stop and save
						</DropdownMenu.Item>
						<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
							Saves the whole machine as a restore point, then stops it.
						</div>
						<DropdownMenu.Item
							class="text-failed-text data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
							onSelect={() => stopHere(false)}
							disabled={Boolean(saving)}
						>
							Discard changes and stop
						</DropdownMenu.Item>
						<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
							Stops without saving. The last restore point stays as it was.
						</div>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</header>

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
				<button
					type="button"
					onclick={browserOpenTab}
					aria-label="Open in new tab"
					title="Open in new tab"
					class="text-body flex size-[24px] cursor-pointer items-center justify-center rounded-[5px] border border-white/10 text-[11px] hover:bg-white/5"
				>
					↗
				</button>
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
							class="min-h-0 w-full flex-1 border-0 bg-white {mode === m ? '' : 'hidden'}"
							allow="clipboard-read; clipboard-write"
							sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
						></iframe>
					{/key}
				{:else}
					<iframe
						src={data.session.panes[m].url}
						title="{m} — {sb.name}"
						class="bg-canvas min-h-0 w-full flex-1 border-0 {mode === m ? '' : 'hidden'}"
						allow="clipboard-read; clipboard-write"
					></iframe>
				{/if}
			{/if}
		{/each}
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
	<RestorePointsDrawer
		bind:open={pointsOpen}
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
