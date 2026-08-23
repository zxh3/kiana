<script lang="ts">
/**
 * The command palette: reach a sandbox, or an action, by typing.
 *
 * It shows exactly what the sandboxes table shows — the same two fetches and
 * the same rule about which stopped sandboxes are worth listing — so nothing
 * can be findable in one place and missing from the other.
 *
 * Screen-owned actions are asked for by URL rather than through shared state,
 * which is what makes "Create sandbox" work from inside a sandbox as well.
 */
import { Dialog } from "bits-ui";
import { goto, invalidate } from "$app/navigation";
import { api } from "$lib/api";
import { displayKeys, HELP_KEY, PALETTE_KEY } from "$lib/hotkeys";
import { launch } from "$lib/launch";
import { palette } from "$lib/palette.svelte";
import { shortcutsPanel } from "$lib/shortcutsPanel.svelte";
import { visibleSnapshots } from "$lib/snapshots";
import type { SandboxInfo, SandboxSnapshots, StoppedSandbox } from "$lib/types";

let { workspace }: { workspace: string } = $props();

interface Entry {
  id: string;
  label: string;
  /** Dim text on the right: what Enter does to this row. */
  hint: string;
  group: (typeof groups)[number];
  run: () => void;
}

const groups = ["Sandboxes", "Actions"] as const;

let query = $state("");
let cursor = $state(0);
let running = $state<SandboxInfo[]>([]);
let stopped = $state<StoppedSandbox[]>([]);
let error = $state<string | null>(null);
let listEl = $state<HTMLElement | null>(null);

async function refresh() {
  try {
    const [list, snapshots] = await Promise.all([
      api<{ running: SandboxInfo[]; stopped: StoppedSandbox[] }>(
        "/api/sandboxes",
      ),
      api<{ summary: SandboxSnapshots[] }>("/api/snapshots").catch(() => ({
        summary: [] as SandboxSnapshots[],
      })),
    ]);
    const resumable = new Set(
      snapshots.summary
        .filter((entry) => visibleSnapshots(entry.snapshots).length > 0)
        .map((entry) => entry.sandbox),
    );
    running = [...list.running].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    // A stopped sandbox with no snapshot has nothing to go back to, so the
    // table leaves it out of the list and the palette follows.
    stopped = list.stopped
      .filter((sb) => resumable.has(sb.name))
      .sort((a, b) => b.stoppedAt.localeCompare(a.stoppedAt));
    error = null;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
}

// Opening is the only trigger to re-read. Whatever was there last stays on
// screen while it refreshes, so re-opening never flashes an empty list.
$effect(() => {
  if (!palette.open) return;
  query = "";
  cursor = 0;
  void refresh();
});

const entries = $derived<Entry[]>([
  ...running.map((sb) => ({
    id: sb.sandboxId,
    label: sb.name,
    hint: "zsh",
    group: "Sandboxes" as const,
    run: () => void goto(`/s/${sb.sandboxId}?mode=zsh`),
  })),
  ...stopped.map((sb) => {
    const {
      sandboxId: _id,
      createdAt: _created,
      stoppedAt: _stopped,
      ...spec
    } = sb;
    return {
      id: `stopped:${sb.name}`,
      label: sb.name,
      hint: "start",
      group: "Sandboxes" as const,
      run: () => {
        // The same fire-and-forget launch the table's Start does — and the
        // table is where it lands, because that row narrates the progress.
        // The refresh is what makes the row pick the launch up: without it it
        // sits at "Stopped" while the machine is already coming up.
        void launch(workspace, spec);
        void goto("/").then(() => invalidate("app:sandboxes"));
      },
    };
  }),
  {
    id: "create",
    label: "Create sandbox",
    hint: displayKeys("C"),
    group: "Actions" as const,
    run: () => void goto("/?new=1"),
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    hint: displayKeys(HELP_KEY),
    group: "Actions" as const,
    run: () => (shortcutsPanel.open = true),
  },
  {
    id: "settings",
    label: "Settings",
    hint: "",
    group: "Actions" as const,
    run: () => void goto("/connect"),
  },
]);

const matches = $derived(
  entries.filter((entry) =>
    entry.label.toLowerCase().includes(query.trim().toLowerCase()),
  ),
);
/** Clamped here rather than corrected in an effect, so filtering cannot desync. */
const active = $derived(Math.min(cursor, Math.max(0, matches.length - 1)));

function choose(entry: Entry | undefined) {
  if (!entry) return;
  palette.open = false;
  entry.run();
}

function move(delta: number) {
  if (matches.length === 0) return;
  cursor = (active + delta + matches.length) % matches.length;
  queueMicrotask(() =>
    listEl
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" }),
  );
}

function onkeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    move(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    move(-1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    choose(matches[active]);
  }
}
</script>

<Dialog.Root bind:open={palette.open}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-[70] bg-black/55" />
		<Dialog.Content
			class="bg-overlay shadow-overlay fixed top-[13vh] left-1/2 z-[80] flex max-h-[70vh]
				w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 flex-col overflow-hidden
				rounded-[11px] border border-white/12 focus:outline-none"
		>
			<Dialog.Title class="sr-only">Command palette</Dialog.Title>
			<Dialog.Description class="sr-only">
				Search sandboxes by name, or pick an action.
			</Dialog.Description>

			<input
				bind:value={query}
				{onkeydown}
				oninput={() => (cursor = 0)}
				placeholder="Search sandboxes, or pick an action…"
				spellcheck="false"
				autocomplete="off"
				aria-label="Search sandboxes or actions"
				class="text-ink placeholder:text-faint flex-none border-b border-white/10 bg-transparent
					px-[15px] py-[13px] text-[13.5px] leading-none focus:outline-none"
			/>

			<div bind:this={listEl} class="min-h-0 flex-1 overflow-y-auto p-[6px]">
				{#if error}
					<p class="text-failed-text px-[10px] py-[11px] text-[12px] leading-[1.5]">{error}</p>
				{:else if matches.length === 0}
					<p class="text-muted px-[10px] py-[11px] text-[12px]">
						{query.trim() ? `Nothing matches “${query.trim()}”.` : 'Nothing here yet.'}
					</p>
				{/if}

				{#each groups as group (group)}
					{@const items = matches.filter((entry) => entry.group === group)}
					{#if items.length > 0}
						<div class="section-label px-[10px] pt-[9px] pb-[6px]">{group.toUpperCase()}</div>
						{#each items as entry (entry.id)}
							{@const index = matches.indexOf(entry)}
							<button
								type="button"
								data-active={index === active}
								onclick={() => choose(entry)}
								onmouseenter={() => (cursor = index)}
								class="flex w-full cursor-pointer items-center gap-3 rounded-md px-[10px] py-[9px]
									text-left data-[active=true]:bg-white/6"
							>
								<span
									class="text-control min-w-0 flex-1 truncate text-[12.5px] leading-none
										{group === 'Sandboxes' ? 'font-mono' : ''}"
								>
									{entry.label}
								</span>
								{#if entry.hint}
									<span class="text-faint flex-none font-mono text-[10.5px] leading-none">
										{entry.hint}
									</span>
								{/if}
							</button>
						{/each}
					{/if}
				{/each}
			</div>

			<div
				class="text-muted flex flex-none items-center gap-[13px] border-t border-white/8 px-[15px]
					py-[9px] text-[10.5px] leading-none"
			>
				<span><span class="font-mono">↑↓</span> move</span>
				<span><span class="font-mono">↵</span> open</span>
				<span><span class="font-mono">esc</span> close</span>
				<span class="ml-auto font-mono">{displayKeys(PALETTE_KEY)}</span>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
