<script lang="ts">
import { Dialog } from "bits-ui";
import { ApiError, api } from "$lib/api";
import { formatAgo } from "$lib/format";
import { hiddenPoints, hidePoint } from "$lib/restorePoints";
import type { RestorePoint, SandboxSpec } from "$lib/types";

let {
  open = $bindable(false),
  sandbox,
  spec,
  workspace,
  runtimeVersion,
  onstart,
  onfork,
}: {
  open?: boolean;
  sandbox: string;
  spec: SandboxSpec | null;
  workspace: string;
  runtimeVersion: number;
  /** Boot this sandbox from an older point rather than its newest. */
  onstart: (point: RestorePoint) => void;
  onfork: (point: RestorePoint) => void;
} = $props();

let points = $state<RestorePoint[] | null>(null);
let error = $state<string | null>(null);
let busy = $state<string | null>(null);
let now = $state(Date.now());

// Load on open, and forget on close so a reopen always shows Modal's truth.
$effect(() => {
  if (!open) {
    points = null;
    return;
  }
  void refresh();
});

async function refresh() {
  error = null;
  try {
    const hidden = hiddenPoints(workspace);
    const result = await api<{ points: RestorePoint[] }>(
      `/api/restore-points?sandbox=${encodeURIComponent(sandbox)}`,
    );
    points = result.points.filter((p) => !hidden.includes(p.tag));
    now = Date.now();
  } catch (e) {
    error = e instanceof ApiError ? e.message : String(e);
    points = [];
  }
}

async function pin(point: RestorePoint) {
  busy = point.tag;
  error = null;
  try {
    await api("/api/restore-points", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag: point.tag, label: "" }),
    });
    await refresh();
  } catch (e) {
    error = e instanceof ApiError ? e.message : String(e);
  } finally {
    busy = null;
  }
}

async function remove(point: RestorePoint) {
  busy = point.tag;
  error = null;
  try {
    await api(`/api/restore-points?tag=${encodeURIComponent(point.tag)}`, {
      method: "DELETE",
    });
    // Modal has no unpublish, so the tag would keep listing — remember locally
    // that this one is gone.
    hidePoint(workspace, point.tag);
    await refresh();
  } catch (e) {
    error = e instanceof ApiError ? e.message : String(e);
  } finally {
    busy = null;
  }
}

function expiryLabel(point: RestorePoint): string {
  if (!point.expiresAt) return "kept";
  const days = Math.max(
    0,
    Math.round((new Date(point.expiresAt).getTime() - now) / 86_400_000),
  );
  return days <= 1 ? "expires today" : `expires in ${days}d`;
}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />
		<Dialog.Content
			class="bg-drawer text-ink fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-white/10 focus:outline-none"
		>
			<div class="flex items-start justify-between border-b border-white/8 px-[22px] pt-5 pb-4">
				<div class="flex flex-col gap-[5px]">
					<Dialog.Title class="text-[17px] leading-[1.1] font-semibold tracking-[-0.2px]">
						Restore points
					</Dialog.Title>
					<Dialog.Description class="text-secondary text-xs leading-[1.4]">
						<span class="font-mono">{sandbox}</span> · each point is the whole machine, saved
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
						class="border-failed/28 bg-failed/6 flex items-center gap-[9px] rounded-lg border px-[13px] py-[11px]"
					>
						<span class="bg-failed size-[6px] shrink-0 rounded-full"></span>
						<span class="text-failed-text text-xs leading-[1.4]">{error}</span>
					</div>
				{/if}

				{#if points === null}
					<span class="text-muted flex items-center gap-[9px] py-2 text-[12px]">
						<span class="bg-accent size-[5px] animate-pulse rounded-full"></span>
						loading restore points…
					</span>
				{:else if points.length === 0}
					<p class="text-body max-w-[420px] text-[12px] leading-[1.6]">
						No restore points yet. Stopping <span class="font-mono">{sandbox}</span> saves one —
						packages, config, /workspace and all — and starting it again restores it.
					</p>
				{:else}
					{#each points as point (point.tag)}
						<div
							class="flex flex-col gap-[9px] rounded-[9px] border border-white/8 bg-white/2 px-[13px] py-[11px]"
						>
							<div class="flex min-w-0 items-baseline gap-[9px]">
								<span class="truncate font-mono text-[12.5px] leading-none font-medium">
									{point.label || 'automatic'}
								</span>
								{#if point.kind === 'keep'}
									<span
										class="text-accent border-accent/30 flex-none rounded-[4px] border px-[5px] py-[2px] text-[9.5px] leading-none font-medium"
									>
										KEPT
									</span>
								{/if}
								{#if point.runtime < runtimeVersion}
									<span
										class="text-muted flex-none rounded-[4px] border border-white/12 px-[5px] py-[2px] text-[9.5px] leading-none"
										title="Taken on an older qook runtime — binaries in the image are from then"
									>
										r{point.runtime}
									</span>
								{/if}
								<span class="text-faint ml-auto flex-none font-mono text-[10.5px] whitespace-nowrap">
									{formatAgo(point.createdAt, now)} · {expiryLabel(point)}
								</span>
							</div>
							<div class="flex flex-wrap items-center gap-[6px]">
								{#if spec}
									<button
										type="button"
										onclick={() => {
											open = false;
											onstart(point);
										}}
										class="text-control cursor-pointer rounded-[5px] border border-white/14 px-[9px] py-[5px] text-[11px] leading-none font-medium hover:bg-white/5"
									>
										Start from here
									</button>
									<button
										type="button"
										onclick={() => {
											open = false;
											onfork(point);
										}}
										class="text-control cursor-pointer rounded-[5px] border border-white/14 px-[9px] py-[5px] text-[11px] leading-none font-medium hover:bg-white/5"
									>
										Fork…
									</button>
								{/if}
								{#if point.kind === 'auto'}
									<button
										type="button"
										onclick={() => pin(point)}
										disabled={busy === point.tag}
										title="Keep this point indefinitely instead of letting it expire"
										class="text-control cursor-pointer rounded-[5px] border border-white/14 px-[9px] py-[5px] text-[11px] leading-none font-medium hover:bg-white/5 disabled:opacity-60"
									>
										{busy === point.tag ? 'Pinning…' : 'Pin'}
									</button>
								{/if}
								<button
									type="button"
									onclick={() => remove(point)}
									disabled={busy === point.tag}
									class="text-failed-text ml-auto cursor-pointer rounded-[5px] border border-white/12 px-[9px] py-[5px] text-[11px] leading-none font-medium hover:bg-white/5 disabled:opacity-60"
								>
									Delete
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
