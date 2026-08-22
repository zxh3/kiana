<script lang="ts">
import { Dialog, Slider } from "bits-ui";
import {
  cpuOptions,
  gpuCountOptions,
  gpuOptions,
  memoryRange,
  type SandboxSpec,
  type Snapshot,
  sandboxNamePattern,
} from "$lib/types";

let {
  open = $bindable(false),
  snapshot,
  spec,
  takenNames = [],
  onfork,
}: {
  open?: boolean;
  /** The snapshot to fork from; null while the dialog is closed. */
  snapshot: Snapshot | null;
  /** The source sandbox's spec — the fork's defaults. */
  spec: SandboxSpec | null;
  takenNames?: string[];
  onfork: (spec: SandboxSpec, snapshot: Snapshot) => void;
} = $props();

let name = $state("");
let cpu = $state(8);
let memory = $state(32);
let gpu = $state("none");
let gpuCount = $state(1);
let error = $state<string | null>(null);

// Inherit the source's hardware each time the dialog opens; the whole purpose of
// a fork dialog is that these are the values you might want to change.
$effect(() => {
  if (!open || !spec || !snapshot) return;
  name = `${spec.name}-fork`;
  cpu = spec.cpu;
  memory = spec.memoryGib;
  gpu = spec.gpu ?? "none";
  gpuCount = spec.gpuCount;
  error = null;
});

const chip =
  "flex-1 cursor-pointer rounded-md border py-[9px] text-center font-mono text-xs";
const chipOff = "border-white/10 text-data hover:border-white/20";
const chipOn = "border-accent bg-accent/12 font-semibold text-accent-bright";

function submit(event: SubmitEvent) {
  event.preventDefault();
  if (!snapshot || !spec) return;
  const target = name.trim();
  if (!sandboxNamePattern.test(target)) {
    error =
      "Name must be lowercase letters, digits and dashes (up to 32 characters).";
    return;
  }
  if (target === spec.name) {
    error = "A fork needs a different name — that one is the source.";
    return;
  }
  if (takenNames.includes(target)) {
    error = `${target} is already running — pick another name.`;
    return;
  }
  open = false;
  onfork(
    {
      ...spec,
      name: target,
      cpu,
      memoryGib: memory,
      gpu: gpu === "none" ? null : gpu,
      gpuCount,
    },
    snapshot,
  );
}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />
		<Dialog.Content
			class="bg-drawer text-ink fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-white/10 focus:outline-none"
		>
			<form onsubmit={submit} class="flex h-full min-h-0 flex-col">
				<div class="flex items-start justify-between border-b border-white/8 px-[22px] pt-5 pb-4">
					<div class="flex flex-col gap-[5px]">
						<Dialog.Title class="text-[17px] leading-[1.1] font-semibold tracking-[-0.2px]">
							Fork sandbox
						</Dialog.Title>
						<Dialog.Description class="text-secondary text-xs leading-[1.4]">
							A copy of <span class="font-mono">{snapshot?.sandbox}</span>
							{snapshot?.label ? `at ${snapshot.label}` : 'at its last snapshot'}, under a new
							name. Starts in seconds.
						</Dialog.Description>
					</div>
					<Dialog.Close
						class="text-body flex size-[26px] cursor-pointer items-center justify-center rounded-md border border-white/12 text-xs hover:bg-white/5"
						aria-label="Close"
					>
						✕
					</Dialog.Close>
				</div>

				<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[22px] py-5">
					<label class="flex flex-col gap-2">
						<span class="text-label text-[11.5px] font-medium">Name</span>
						<input
							bind:value={name}
							required
							autocomplete="off"
							spellcheck="false"
							data-1p-ignore
							data-lpignore="true"
							class="focus:border-accent/45 rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px]
								font-mono text-[13px] focus:bg-white/3 focus:outline-none"
						/>
					</label>

					<div class="flex flex-col gap-[9px]">
						<div class="flex items-baseline justify-between">
							<span class="text-label text-[11.5px] font-medium">CPU</span>
							<span class="text-accent font-mono text-xs font-medium">{cpu} vCPU</span>
						</div>
						<div class="flex gap-[7px]">
							{#each cpuOptions as option (option)}
								<button
									type="button"
									class="{chip} {cpu === option ? chipOn : chipOff}"
									onclick={() => (cpu = option)}
								>
									{option}
								</button>
							{/each}
						</div>
					</div>

					<div class="flex flex-col gap-[11px]">
						<div class="flex items-baseline justify-between">
							<span class="text-label text-[11.5px] font-medium">Memory</span>
							<span class="text-accent font-mono text-xs font-medium">{memory} GiB</span>
						</div>
						<Slider.Root
							type="single"
							bind:value={memory}
							min={memoryRange.min}
							max={memoryRange.max}
							step={memoryRange.step}
							class="relative flex w-full touch-none items-center select-none"
						>
							{#snippet children({ thumbs })}
								<span class="relative h-[3px] w-full grow rounded-sm bg-white/10">
									<Slider.Range class="bg-accent absolute h-full rounded-sm" />
								</span>
								{#each thumbs as index (index)}
									<Slider.Thumb
										{index}
										class="bg-accent border-drawer block size-[13px] cursor-pointer rounded-full border-2 focus:outline-none"
									/>
								{/each}
							{/snippet}
						</Slider.Root>
					</div>

					<div class="flex flex-col gap-[9px]">
						<div class="flex items-baseline justify-between">
							<span class="text-label text-[11.5px] font-medium">GPU</span>
							{#if gpu !== 'none'}
								<span class="text-accent font-mono text-xs font-medium">
									{gpuCount > 1 ? `${gpu}:${gpuCount}` : gpu}
								</span>
							{/if}
						</div>
						<div class="grid grid-cols-4 gap-[7px]">
							{#each gpuOptions as option (option)}
								<button
									type="button"
									class="{chip} {gpu === option ? chipOn : chipOff}"
									onclick={() => (gpu = option)}
								>
									{option}
								</button>
							{/each}
						</div>
						{#if gpu !== 'none'}
							<div class="flex gap-[7px]">
								{#each gpuCountOptions as option (option)}
									<button
										type="button"
										class="{chip} {gpuCount === option ? chipOn : chipOff}"
										onclick={() => (gpuCount = option)}
									>
										{option}
									</button>
								{/each}
							</div>
						{/if}
						<span class="text-muted text-[11px] leading-[1.5]">
							The same machine on different hardware: develop on CPU, fork onto a GPU.
						</span>
					</div>

					{#if spec && spec.volumes.length > 0}
						<div class="flex flex-col gap-[7px]">
							<span class="text-label text-[11.5px] font-medium">Inherited volume mounts</span>
							{#each spec.volumes as volume (volume.mount)}
								<span
									class="text-data flex items-center gap-2 font-mono text-[11.5px] leading-none whitespace-nowrap"
								>
									{volume.name}
									<span class="text-muted">→</span>
									<span class="text-control">{volume.mount}</span>
								</span>
							{/each}
							<span class="text-muted text-[11px] leading-[1.5]">
								Volumes are mounted, not copied — the fork writes to the same data as
								<span class="font-mono">{spec.name}</span>.
							</span>
						</div>
					{/if}

					{#if error}
						<div
							class="border-failed/28 bg-failed/6 flex items-center gap-[9px] rounded-lg border px-[13px] py-[11px]"
						>
							<span class="bg-failed size-[6px] shrink-0 rounded-full"></span>
							<span class="text-failed-text text-xs leading-[1.4]">{error}</span>
						</div>
					{/if}
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-white/8 px-[22px] py-[14px]">
					<Dialog.Close
						class="text-control cursor-pointer rounded-[7px] border border-white/12 px-[14px] py-[10px] text-[12.5px] font-medium hover:bg-white/5"
					>
						Cancel
					</Dialog.Close>
					<button
						type="submit"
						class="bg-accent text-canvas cursor-pointer rounded-[7px] px-[18px] py-[10px] text-[12.5px] font-semibold"
					>
						Fork
					</button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
