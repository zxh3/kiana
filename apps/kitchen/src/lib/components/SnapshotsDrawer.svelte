<script lang="ts">
import { Dialog } from "bits-ui";
import { ApiError, api } from "$lib/api";
import { formatAgo } from "$lib/format";
import { visibleSnapshots } from "$lib/snapshots";
import type { SandboxSpec, Snapshot } from "$lib/types";

let {
  open = $bindable(false),
  sandbox,
  spec,
  running,
  workspace,
  runtimeVersion,
  onstart,
  onfork,
  onrestore,
}: {
  open?: boolean;
  sandbox: string;
  spec: SandboxSpec | null;
  /** A running sandbox restores in place instead of starting. */
  running: boolean;
  workspace: string;
  runtimeVersion: number;
  onstart: (snapshot: Snapshot) => void;
  onfork: (snapshot: Snapshot) => void;
  /** Rewind a running sandbox to this snapshot, optionally saving first. */
  onrestore: (snapshot: Snapshot, saveFirst: boolean) => void;
} = $props();

let snapshots = $state<Snapshot[] | null>(null);
let error = $state<string | null>(null);
let busy = $state<string | null>(null);
/** A snapshot whose Start or Fork click has been handed off. */
let handing = $state<string | null>(null);
/** Tag whose "keep" name input is open, plus the name being typed. */
let keeping = $state<string | null>(null);
let keepName = $state("");
/** Tag whose restore confirmation is open. Saving first is the safe default. */
let restoring = $state<string | null>(null);
let saveFirst = $state(true);
let now = $state(Date.now());

// Load on open, and forget on close so a reopen always shows Modal's truth.
$effect(() => {
  if (!open) {
    snapshots = null;
    keeping = null;
    restoring = null;
    return;
  }
  void refresh();
});

async function refresh() {
  error = null;
  try {
    const result = await api<{ snapshots: Snapshot[] }>(
      `/api/snapshots?sandbox=${encodeURIComponent(sandbox)}`,
    );
    snapshots = visibleSnapshots(result.snapshots);
    now = Date.now();
  } catch (e) {
    error = e instanceof ApiError ? e.message : String(e);
    snapshots = [];
  }
}

async function keep(snapshot: Snapshot) {
  busy = snapshot.tag;
  error = null;
  try {
    await api("/api/snapshots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag: snapshot.tag, label: keepName.trim() }),
    });
    keeping = null;
    keepName = "";
    await refresh();
  } catch (e) {
    error = e instanceof ApiError ? e.message : String(e);
  } finally {
    busy = null;
  }
}

async function remove(snapshot: Snapshot) {
  busy = snapshot.tag;
  error = null;
  try {
    await api(`/api/snapshots?tag=${encodeURIComponent(snapshot.tag)}`, {
      method: "DELETE",
    });
    await refresh();
  } catch (e) {
    error = e instanceof ApiError ? e.message : String(e);
  } finally {
    busy = null;
  }
}

function expiryLabel(snapshot: Snapshot): string {
  if (!snapshot.expiresAt) return "kept";
  const days = Math.max(
    0,
    Math.round((new Date(snapshot.expiresAt).getTime() - now) / 86_400_000),
  );
  return days <= 1 ? "expires today" : `expires in ${days}d`;
}

const action =
  "cursor-pointer rounded-[5px] border border-white/14 px-[9px] py-[5px] text-[11px] leading-none font-medium hover:bg-white/5 disabled:opacity-60";
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />
		<Dialog.Content
			class="bg-drawer text-ink fixed inset-y-0 right-0 z-50 flex w-full max-w-[580px] flex-col border-l border-white/10 focus:outline-none"
		>
			<div class="flex items-start justify-between border-b border-white/8 px-[22px] pt-5 pb-4">
				<div class="flex flex-col gap-[5px]">
					<Dialog.Title class="text-[17px] leading-[1.1] font-semibold tracking-[-0.2px]">
						Snapshots
					</Dialog.Title>
					<Dialog.Description class="text-secondary text-xs leading-[1.5]">
						<span class="font-mono">{sandbox}</span> · each snapshot is the whole machine as it was
						when you stopped it
					</Dialog.Description>
				</div>
				<Dialog.Close
					class="text-body flex size-[26px] cursor-pointer items-center justify-center rounded-md border border-white/12 text-xs hover:bg-white/5"
					aria-label="Close"
				>
					✕
				</Dialog.Close>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-[22px] py-5">
				{#if error}
					<div
						class="border-failed/28 bg-failed/6 flex items-start gap-[9px] rounded-lg border px-[13px] py-[11px]"
					>
						<span class="bg-failed mt-[5px] size-[6px] shrink-0 rounded-full"></span>
						<span class="text-failed-text text-xs leading-[1.5]">{error}</span>
					</div>
				{/if}

				{#if snapshots === null}
					<span class="text-muted flex items-center gap-[9px] py-2 text-[12px]">
						<span class="bg-accent size-[5px] animate-pulse rounded-full"></span>
						loading snapshots…
					</span>
				{:else if snapshots.length === 0}
					<p class="text-body max-w-[440px] text-[12px] leading-[1.6]">
						No snapshots yet. Stopping <span class="font-mono">{sandbox}</span> saves one —
						packages, config, /workspace and all — and starting it again picks up from there.
					</p>
				{:else}
					<!-- The model, stated where the confusion would otherwise happen -->
					<p class="text-muted mb-1 text-[11.5px] leading-[1.6]">
						{running ? 'Restore' : 'Start'} puts
						<span class="font-mono">{sandbox}</span> back at a snapshot{running
							? ''
							: ' — plain Start uses the newest'}.
						<span class="text-secondary">Keep</span> stops a snapshot expiring; it does not change
						which snapshot is newest. <span class="text-secondary">Fork</span> branches a snapshot into
						a separate sandbox, leaving this one alone.
					</p>

					{#each snapshots as snapshot, i (snapshot.tag)}
						<div
							class="flex flex-col gap-[9px] rounded-[9px] border px-[13px] py-[11px]
								{i === 0 ? 'border-accent/25 bg-accent/4' : 'border-white/8 bg-white/2'}"
						>
							<div class="flex min-w-0 flex-wrap items-baseline gap-[9px]">
								<span class="truncate font-mono text-[12.5px] leading-none font-medium">
									{snapshot.label || 'automatic'}
								</span>
								{#if i === 0}
									<span
										class="text-accent border-accent/30 flex-none rounded-[4px] border px-[5px] py-[2px] text-[9.5px] leading-none font-medium"
										title={running
											? 'The newest snapshot — what Start would use once this sandbox is stopped'
											: 'Start uses this snapshot'}
									>
										{running ? 'NEWEST' : 'NEXT START'}
									</span>
								{/if}
								{#if snapshot.kind === 'keep'}
									<span
										class="text-data flex-none rounded-[4px] border border-white/14 px-[5px] py-[2px] text-[9.5px] leading-none font-medium"
										title="Kept — this snapshot will not expire"
									>
										KEPT
									</span>
								{/if}
								{#if snapshot.runtime < runtimeVersion}
									<span
										class="text-muted flex-none rounded-[4px] border border-white/12 px-[5px] py-[2px] text-[9.5px] leading-none"
										title="Captured on an older kitchen runtime (r{snapshot.runtime}) — the tools baked into the image are from then"
									>
										r{snapshot.runtime}
									</span>
								{/if}
								<span class="text-faint ml-auto flex-none font-mono text-[10.5px] whitespace-nowrap">
									{formatAgo(snapshot.createdAt, now)} · {expiryLabel(snapshot)}
								</span>
							</div>

							{#if keeping === snapshot.tag}
								<!-- Naming is optional; the snapshot is kept either way -->
								<div class="flex items-center gap-2">
									<input
										bind:value={keepName}
										autocomplete="off"
										spellcheck="false"
										data-1p-ignore
										placeholder="name this snapshot (optional)"
										class="focus:border-accent/45 w-0 flex-1 rounded-[5px] border border-white/10 bg-white/2 px-[9px] py-[6px] font-mono text-[11.5px] leading-none focus:outline-none"
									/>
									<button
										type="button"
										onclick={() => keep(snapshot)}
										disabled={busy === snapshot.tag}
										class="bg-accent text-canvas cursor-pointer rounded-[5px] px-[11px] py-[6px] text-[11px] leading-none font-semibold disabled:opacity-60"
									>
										{busy === snapshot.tag ? 'Keeping…' : 'Keep'}
									</button>
									<button
										type="button"
										onclick={() => {
											keeping = null;
											keepName = '';
										}}
										class="text-body {action}"
									>
										Cancel
									</button>
								</div>
							{:else if restoring === snapshot.tag}
								<!-- Rewinding stops the machine, so say so and offer the safe path -->
								<div class="flex flex-col gap-[8px]">
									<span class="text-body text-[11.5px] leading-[1.6]">
										Put <span class="font-mono">{sandbox}</span> back at
										<span class="font-mono">{snapshot.label || 'this snapshot'}</span>? It stops and
										starts again from here — running processes end either way.
									</span>
									<label class="text-body flex cursor-pointer items-center gap-[7px] text-[11.5px]">
										<input type="checkbox" bind:checked={saveFirst} class="accent-accent size-[13px] cursor-pointer" />
										Save the current state as a new snapshot first
									</label>
									<div class="flex items-center gap-[6px]">
										<button
											type="button"
											onclick={() => {
												open = false;
												onrestore(snapshot, saveFirst);
											}}
											class="bg-accent text-canvas cursor-pointer rounded-[5px] px-[11px] py-[6px] text-[11px] leading-none font-semibold"
										>
											Restore
										</button>
										<button
											type="button"
											onclick={() => (restoring = null)}
											class="text-body {action}"
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<div class="flex flex-wrap items-center gap-[6px]">
									{#if spec && running && i !== 0}
										<button
											type="button"
											onclick={() => {
												restoring = snapshot.tag;
												saveFirst = true;
											}}
											title="Stop this sandbox and start it again from this snapshot"
											class="text-control {action}"
										>
											Restore…
										</button>
									{/if}
									{#if spec && !running}
										<button
											type="button"
											onclick={() => {
												handing = snapshot.tag;
												open = false;
												onstart(snapshot);
											}}
											disabled={handing === snapshot.tag}
											aria-busy={handing === snapshot.tag}
											class="text-control {action}"
										>
											{handing === snapshot.tag
												? 'Starting…'
												: i === 0
													? 'Start'
													: 'Start from here'}
										</button>
									{/if}
									{#if spec}
										<button
											type="button"
											onclick={() => {
												open = false;
												onfork(snapshot);
											}}
											title="Create a separate sandbox from this snapshot"
											class="text-control {action}"
										>
											Fork…
										</button>
									{/if}
									{#if snapshot.kind === 'auto'}
										<button
											type="button"
											onclick={() => {
												keeping = snapshot.tag;
												keepName = '';
											}}
											title="Stop this snapshot expiring; keep it until you delete it"
											class="text-control {action}"
										>
											Keep
										</button>
									{/if}
									<button
										type="button"
										onclick={() => remove(snapshot)}
										disabled={busy === snapshot.tag}
										class="text-failed-text ml-auto cursor-pointer rounded-[5px] border border-white/12 px-[9px] py-[5px] text-[11px] leading-none font-medium hover:bg-white/5 disabled:opacity-60"
									>
										{busy === snapshot.tag ? 'Deleting…' : 'Delete'}
									</button>
								</div>
							{/if}
						</div>
					{/each}

					{#if running}
						<p class="text-muted mt-1 text-[11px] leading-[1.6]">
							<span class="font-mono">{sandbox}</span> is running on its newest snapshot. Restore
							rewinds it in place; Fork leaves it running and branches into a new sandbox.
						</p>
					{/if}
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
