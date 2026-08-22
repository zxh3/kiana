<script lang="ts">
import { DropdownMenu } from "bits-ui";
import { goto, invalidate, replaceState } from "$app/navigation";
import { page } from "$app/state";
import { ApiError, api } from "$lib/api";
import { formatResources, formatUptime } from "$lib/format";
import { modePorts, type SessionMode, sessionModes } from "$lib/types";
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
let terminating = $state(false);
let actionError = $state<string | null>(null);

function switchMode(m: SessionMode) {
  visited[m] = true;
  mode = m;
  replaceState(`?mode=${m}`, {});
}

let now = $state(Date.now());
$effect(() => {
  const t = setInterval(() => (now = Date.now()), 30_000);
  return () => clearInterval(t);
});

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

async function terminate() {
  terminating = true;
  actionError = null;
  try {
    await api(`/api/sandboxes/${data.id}`, { method: "DELETE" });
    await goto("/");
  } catch (e) {
    actionError = e instanceof ApiError ? e.message : String(e);
  } finally {
    terminating = false;
  }
}

const sb = $derived(data.session?.sandbox ?? null);
</script>

<svelte:head>
	<title>{sb?.name ?? 'sandbox'} · qook</title>
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
							class="text-failed-text data-highlighted:bg-white/6 cursor-pointer rounded-md px-[9px] py-[9px] text-[12.5px]"
							onSelect={terminate}
							disabled={terminating}
						>
							{terminating ? 'Terminating…' : 'Terminate sandbox'}
						</DropdownMenu.Item>
						<div class="text-muted px-[9px] pt-[3px] pb-[7px] text-[10.5px] leading-[1.5]">
							Stops the machine. It stays listed — Start restores its state.
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

		{#each sessionModes as m (m)}
			{#if visited[m] && data.session.panes[m].ready}
				<iframe
					src={data.session.panes[m].url}
					title="{m} — {sb.name}"
					class="bg-canvas min-h-0 w-full flex-1 border-0 {mode === m ? '' : 'hidden'}"
					allow="clipboard-read; clipboard-write"
				></iframe>
			{/if}
		{/each}
		{#if !data.session.panes[mode].ready}
			<div class="flex flex-1 flex-col items-center justify-center gap-3">
				<span class="flex items-center gap-[9px]">
					<span class="bg-accent size-[6px] animate-pulse rounded-full"></span>
					<span class="text-body font-mono text-[12.5px]">starting {mode}…</span>
				</span>
				<p class="text-muted text-[11.5px]">The sandbox is booting its services.</p>
			</div>
		{/if}
	{/if}
</div>
