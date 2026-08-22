<script lang="ts">
import { DropdownMenu, Popover } from "bits-ui";
import { goto, invalidate } from "$app/navigation";
import { api } from "$lib/api";
import CreateSandboxDialog from "$lib/components/CreateSandboxDialog.svelte";
import ForkDialog from "$lib/components/ForkDialog.svelte";
import Logo from "$lib/components/Logo.svelte";
import RestorePointsDrawer from "$lib/components/RestorePointsDrawer.svelte";
import StatusDot from "$lib/components/StatusDot.svelte";
import { formatAgo, formatResources, formatUptime } from "$lib/format";
import { type LaunchOptions, launch, stop } from "$lib/launch";
import { clearError, forgetSandbox } from "$lib/sandboxStore";
import { loadSettings } from "$lib/settings";
import {
  type OpPhase,
  opPhaseLabels,
  type RestorePoint,
  type SandboxSpec,
  sessionModes,
} from "$lib/types";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

let createOpen = $state(false);
let refreshing = $state(false);
let enterOpenId = $state<string | null>(null);
let actionError = $state<string | null>(null);
let now = $state(Date.now());

// Phases arrive on the launch's own stream, ahead of any list refresh, so the
// live phase is kept here and the persisted one (from the store) is the
// fallback after a reload.
let livePhase = $state<Record<string, OpPhase>>({});

// Restore points and forking, both driven from a row.
let pointsFor = $state<string | null>(null);
let pointsOpen = $state(false);
let forkPoint = $state<RestorePoint | null>(null);
let forkSpec = $state<SandboxSpec | null>(null);
let forkOpen = $state(false);

const pending = $derived(
  data.rows.some(
    (row) =>
      row.kind === "creating" || (row.kind === "running" && row.stopping),
  ),
);

// A pending row shows a ticking elapsed time; otherwise a slow tick is plenty.
$effect(() => {
  const t = setInterval(() => (now = Date.now()), pending ? 1000 : 30_000);
  return () => clearInterval(t);
});

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    await invalidate("app:sandboxes");
  } finally {
    refreshing = false;
  }
}

// Modal is the source of truth — poll it, fast while an operation is in
// flight so rows settle on their own, slowly when everything is at rest.
$effect(() => {
  const t = setInterval(
    () => {
      if (document.visibilityState === "visible") refresh();
    },
    pending ? 4000 : 30_000,
  );
  return () => clearInterval(t);
});

function startLaunch(spec: SandboxSpec, options: LaunchOptions = {}) {
  actionError = null;
  livePhase[spec.name] = "resolving";
  // Deliberately not awaited: a launch outlives the click, and the row in the
  // table is where its progress shows.
  void launch(
    data.workspace,
    spec,
    {
      onPhase: (phase) => {
        livePhase[spec.name] = phase;
      },
      onDone: () => {
        delete livePhase[spec.name];
        void invalidate("app:sandboxes");
      },
      onError: () => {
        delete livePhase[spec.name];
        void invalidate("app:sandboxes");
      },
    },
    options,
  );
  void invalidate("app:sandboxes");
}

/**
 * Stop a sandbox. By default the machine is snapshotted on the way out, which
 * is the slow part — so this is fire-and-forget too, with the phases showing
 * on the row.
 */
function stopSandbox(sandboxId: string, name: string, save = true) {
  actionError = null;
  livePhase[name] = save ? "snapshotting" : "stopping";
  void stop(
    data.workspace,
    sandboxId,
    name,
    { save, retentionDays: loadSettings().retentionDays },
    {
      onPhase: (phase) => {
        livePhase[name] = phase;
      },
      onDone: () => {
        delete livePhase[name];
        void invalidate("app:sandboxes");
      },
      onError: (message) => {
        delete livePhase[name];
        actionError = message;
        void invalidate("app:sandboxes");
      },
    },
  );
  void invalidate("app:sandboxes");
}

function openPoints(name: string) {
  pointsFor = name;
  pointsOpen = true;
}

function openFork(point: RestorePoint) {
  const row = data.rows.find(
    (r) => (r.kind === "running" ? r.sb.name : r.spec.name) === point.sandbox,
  );
  forkSpec = row ? (row.kind === "running" ? row.sb : row.spec) : null;
  forkPoint = point;
  forkOpen = true;
}

async function forget(name: string) {
  forgetSandbox(data.workspace, name);
  // The rows are browser-local, but the restore points are not — dropping the
  // row without them would leak storage nothing can reach.
  try {
    await api(`/api/restore-points?sandbox=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  } catch {
    // the row is already gone from this browser; surfacing this would only
    // confuse, and the points expire on their own
  }
  await invalidate("app:sandboxes");
}

async function dismissError(name: string) {
  clearError(data.workspace, name);
  await invalidate("app:sandboxes");
}

function phaseLabel(name: string, stored: OpPhase | null): string {
  const phase = livePhase[name] ?? stored;
  return phase ? opPhaseLabels[phase] : "starting";
}

function elapsed(since: string): string {
  const secs = Math.max(
    0,
    Math.round((now - new Date(since).getTime()) / 1000),
  );
  return secs < 60
    ? `${secs}s`
    : `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`;
}

const gridCols = "grid-cols-[1.6fr_0.8fr_1.1fr_0.8fr_150px]";
const modeIcons: Record<string, string> = {
  zsh: ">_",
  herdr: "H",
  vscode: "{ }",
  browser: "://",
};
</script>

<svelte:head>
	<title>qook</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- Top bar -->
	<header class="flex h-[50px] flex-none items-center gap-4 border-b border-white/8 px-[22px]">
		<a href="/"><Logo size={16} /></a>
		<div class="flex-1"></div>
		<span class="text-secondary flex items-center gap-[7px] font-mono text-[11.5px]">
			<span class="bg-running size-[5px] rounded-full"></span>
			{data.connection?.workspace}{data.connection?.environment
				? ` / ${data.connection.environment}`
				: ''}
		</span>
		<a href="/connect" class="text-secondary hover:text-control text-xs">Settings</a>
	</header>

	<!-- Page header -->
	<div class="flex items-end justify-between px-[22px] pt-[22px] pb-4">
		<h1 class="text-[19px] leading-[1.1] font-semibold tracking-[-0.3px]">Sandboxes</h1>
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={refresh}
				disabled={refreshing}
				aria-label="Refresh"
				title="Refresh"
				class="text-body flex size-[30px] cursor-pointer items-center justify-center rounded-md border border-white/12 text-[13px] hover:bg-white/5 disabled:opacity-60"
			>
				<span class={refreshing ? 'animate-spin' : ''}>↻</span>
			</button>
			<button
				type="button"
				onclick={() => (createOpen = true)}
				class="bg-accent text-canvas cursor-pointer rounded-md px-[14px] py-2 text-[12.5px] font-semibold"
			>
				+ Create sandbox
			</button>
		</div>
	</div>

	{#if actionError}
		<div class="px-[22px] pb-3">
			<div
				class="border-failed/28 bg-failed/6 flex items-center gap-[9px] rounded-lg border px-[13px] py-[11px]"
			>
				<span class="bg-failed size-[6px] shrink-0 rounded-full"></span>
				<span class="text-failed-text text-xs leading-[1.4]">{actionError}</span>
			</div>
		</div>
	{/if}

	{#if data.rows.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-3 pb-24">
			<p class="text-body text-[12.5px]">No running sandboxes.</p>
			<button
				type="button"
				onclick={() => (createOpen = true)}
				class="text-control cursor-pointer rounded-md border border-white/12 px-[14px] py-2 text-[12.5px] font-medium hover:bg-white/5"
			>
				Create a sandbox
			</button>
		</div>
	{:else}
		<!-- Column headers -->
		<div class="grid {gridCols} section-label gap-4 border-b border-white/8 px-[22px] pb-2">
			<div>SANDBOX</div>
			<div>STATUS</div>
			<div>RESOURCES</div>
			<div>UPTIME</div>
			<div></div>
		</div>

		{#each data.rows as row (row.kind === 'running' ? row.sb.name : row.spec.name)}
			{@const sb = row.kind === 'running' ? row.sb : null}
			{@const spec = row.kind === 'running' ? row.sb : row.spec}
			{@const selected = sb !== null && enterOpenId === sb.sandboxId}
			<div
				class="grid {gridCols} items-center gap-4 border-b border-white/6 px-[22px] py-[14px]
					{selected ? 'bg-accent/5 shadow-[inset_2px_0_0_var(--color-accent)]' : ''}
					{row.kind === 'stopped' ? 'opacity-72' : ''}"
			>
				<div class="flex min-w-0 flex-col gap-1">
					<span class="flex min-w-0 items-center gap-[7px]">
						<span class="truncate font-mono text-[13.5px] leading-none font-semibold">
							{spec.name}
						</span>
						{#if sb && sb.volumes.length > 0}
							<Popover.Root>
								<Popover.Trigger
									class="text-secondary hover:text-control flex-none cursor-pointer rounded-[5px] border border-white/10 px-[6px] py-[3px] font-mono text-[10px] leading-none hover:bg-white/5"
									aria-label="Show volume mounts"
								>
									{sb.volumes.length}
									vol{sb.volumes.length > 1 ? 's' : ''}
								</Popover.Trigger>
								<Popover.Portal>
									<Popover.Content
										class="bg-overlay shadow-overlay z-50 flex max-w-[420px] flex-col gap-[9px] rounded-[9px] border border-white/12 p-[13px]"
										sideOffset={6}
										align="start"
									>
										<span class="section-label">VOLUME MOUNTS</span>
										{#each sb.volumes as volume (volume.mount)}
											<span
												class="text-data flex items-center gap-2 font-mono text-[11.5px] leading-none whitespace-nowrap"
											>
												{volume.name}
												<span class="text-muted">→</span>
												<span class="text-control">{volume.mount}</span>
											</span>
										{/each}
										<span class="text-muted text-[10.5px] leading-[1.5]">
											Saved continuously and kept out of restore points.
										</span>
									</Popover.Content>
								</Popover.Portal>
							</Popover.Root>
						{/if}
					</span>
					{#if row.kind === 'stopped'}
						<span class="text-faint truncate text-[11px] leading-none">
							stopped {formatAgo(row.stoppedAt, now)} · {spec.image}
						</span>
					{:else if row.kind === 'failed'}
						<span class="text-failed-text truncate text-[11px] leading-[1.4]" title={row.error}>
							{row.error}
						</span>
					{:else}
						<span class="text-faint truncate text-[11px] leading-none">{spec.image}</span>
					{/if}
				</div>

				<!-- Status -->
				{#if row.kind === 'running'}
					{#if row.stopping}
						<span class="flex items-center gap-[7px] text-[11.5px] leading-none text-[#d9b169]">
							<span class="size-[5px] animate-pulse rounded-full bg-[#d9b169]"></span>
							Stopping…
						</span>
					{:else}
						<StatusDot status="running" />
					{/if}
				{:else if row.kind === 'creating'}
					<span class="text-accent flex items-center gap-[7px] text-[11.5px] leading-none">
						<span class="bg-accent size-[5px] animate-pulse rounded-full"></span>
						{phaseLabel(spec.name, row.phase)}
					</span>
				{:else if row.kind === 'failed'}
					<StatusDot status="failed" />
				{:else}
					<StatusDot status="stopped" />
				{/if}

				<div class="text-data truncate font-mono text-xs">{formatResources(spec)}</div>
				<div class="text-data font-mono text-xs">
					{#if row.kind === 'running'}
						{formatUptime(row.sb.createdAt, now)}
					{:else if row.kind === 'creating'}
						{elapsed(row.startedAt)}
					{:else}
						—
					{/if}
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-end gap-[6px]">
					{#if row.kind === 'running' && sb}
						<DropdownMenu.Root onOpenChange={(open) => (enterOpenId = open ? sb.sandboxId : null)}>
							<DropdownMenu.Trigger
								class="cursor-pointer rounded-[5px] px-[11px] py-[6px] text-[11.5px] leading-none
									{selected
									? 'bg-accent text-canvas font-semibold'
									: 'text-ink border border-white/14 font-medium hover:bg-white/5'}"
							>
								Enter ▾
							</DropdownMenu.Trigger>
							<DropdownMenu.Portal>
								<DropdownMenu.Content
									class="bg-overlay shadow-overlay z-50 w-[230px] rounded-[9px] border border-white/12 p-[5px]"
									sideOffset={6}
									align="end"
								>
									{#each sessionModes as mode (mode)}
										<DropdownMenu.Item
											class="data-highlighted:bg-white/6 flex cursor-pointer items-center gap-[10px] rounded-md p-[9px]"
											onSelect={() => goto(`/s/${sb.sandboxId}?mode=${mode}`)}
										>
											<span
												class="flex size-5 items-center justify-center rounded-[5px] font-mono text-[9.5px] font-semibold
													{mode === 'zsh' ? 'bg-accent/14 text-accent' : 'text-data bg-white/6'}"
											>
												{modeIcons[mode]}
											</span>
											<span class="text-control text-[12.5px]">{mode}</span>
											{#if mode === 'zsh'}
												<span class="text-muted ml-auto font-mono text-[10px] font-medium">↵</span>
											{/if}
										</DropdownMenu.Item>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Portal>
						</DropdownMenu.Root>

						<DropdownMenu.Root>
							<DropdownMenu.Trigger
								class="text-body flex size-[26px] cursor-pointer items-center justify-center rounded-[5px] border border-white/12 text-xs hover:bg-white/5"
								aria-label="More actions"
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
										onSelect={() => openPoints(sb.name)}
									>
										Restore points…
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="text-control data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
										onSelect={() => stopSandbox(sb.sandboxId, sb.name)}
									>
										Stop and save
									</DropdownMenu.Item>
									<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
										Saves the whole machine as a restore point, then stops it. Starting it
										again picks up exactly here.
									</div>
									<DropdownMenu.Item
										class="text-failed-text data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
										onSelect={() => stopSandbox(sb.sandboxId, sb.name, false)}
									>
										Discard changes and stop
									</DropdownMenu.Item>
									<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
										Stops without saving. The last restore point stays as it was.
									</div>
								</DropdownMenu.Content>
							</DropdownMenu.Portal>
						</DropdownMenu.Root>
					{:else if row.kind === 'creating'}
						<span class="text-muted font-mono text-[11px] whitespace-nowrap">
							{phaseLabel(spec.name, row.phase) === opPhaseLabels.image
								? 'first build ~2 min'
								: 'almost there'}
						</span>
					{:else}
						<button
							type="button"
							onclick={() => startLaunch(spec)}
							class="text-control cursor-pointer rounded-[5px] border border-white/14 px-[11px] py-[6px] text-[11.5px] leading-none font-medium hover:bg-white/5"
						>
							{row.kind === 'failed' ? 'Retry' : 'Start'}
						</button>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger
								class="text-body flex size-[26px] cursor-pointer items-center justify-center rounded-[5px] border border-white/12 text-xs hover:bg-white/5"
								aria-label="More actions"
							>
								⋯
							</DropdownMenu.Trigger>
							<DropdownMenu.Portal>
								<DropdownMenu.Content
									class="bg-overlay shadow-overlay z-50 min-w-[210px] rounded-[9px] border border-white/12 p-[5px]"
									sideOffset={6}
									align="end"
								>
									<DropdownMenu.Item
										class="text-control data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
										onSelect={() => openPoints(spec.name)}
									>
										Restore points…
									</DropdownMenu.Item>
									{#if row.kind === 'failed'}
										<DropdownMenu.Item
											class="text-control data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
											onSelect={() => dismissError(spec.name)}
										>
											Dismiss error
										</DropdownMenu.Item>
									{/if}
									<DropdownMenu.Item
										class="text-control data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
										onSelect={() => forget(spec.name)}
									>
										Forget
									</DropdownMenu.Item>
									<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
										Drops the row and deletes this sandbox's restore points.
									</div>
								</DropdownMenu.Content>
							</DropdownMenu.Portal>
						</DropdownMenu.Root>
					{/if}
				</div>
			</div>
		{/each}
	{/if}
</div>

<RestorePointsDrawer
	bind:open={pointsOpen}
	sandbox={pointsFor ?? ''}
	spec={pointsFor
		? (data.rows
				.map((row) => (row.kind === 'running' ? row.sb : row.spec))
				.find((candidate) => candidate.name === pointsFor) ?? null)
		: null}
	workspace={data.workspace}
	runtimeVersion={data.runtimeVersion}
	onstart={(point) => {
		const spec = data.rows
			.map((row) => (row.kind === 'running' ? row.sb : row.spec))
			.find((candidate) => candidate.name === point.sandbox);
		if (spec) startLaunch(spec, { fromPoint: point.tag });
	}}
	onfork={openFork}
/>

<ForkDialog
	bind:open={forkOpen}
	point={forkPoint}
	spec={forkSpec}
	takenNames={data.rows.map((row) => (row.kind === 'running' ? row.sb.name : row.spec.name))}
	onfork={(spec, point) =>
		startLaunch(spec, { fromPoint: point.tag, forkedFrom: point.tag })}
/>

<CreateSandboxDialog
	bind:open={createOpen}
	workspace={data.connection?.workspace ?? ''}
	takenNames={data.rows
		.filter((row) => row.kind === 'running' || row.kind === 'creating')
		.map((row) => (row.kind === 'running' ? row.sb.name : row.spec.name))}
	onlaunch={startLaunch}
/>
