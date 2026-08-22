<script lang="ts">
import { Dialog, Select, Slider } from "bits-ui";
import { ApiError, api } from "$lib/api";
import {
  builtinMounts,
  cpuOptions,
  gpuCountOptions,
  gpuOptions,
  imageOptions,
  maxVolumeMounts,
  memoryRange,
} from "$lib/types";

let {
  open = $bindable(false),
  workspace,
  oncreated,
}: { open?: boolean; workspace: string; oncreated: () => void } = $props();

let name = $state("");
let cpu = $state(8);
let memory = $state(32);
let gpu = $state("none");
let gpuCount = $state(1);
let image = $state<string>(imageOptions[0]);
let volumes = $state<{ name: string; mount: string }[]>([
  { name: "", mount: "" },
]);
let submitting = $state(false);
let error = $state<string | null>(null);
let builtinsOpen = $state(false);

const chip =
  "flex-1 cursor-pointer rounded-md border py-[9px] text-center font-mono text-xs";
const chipOff = "border-white/10 text-data hover:border-white/20";
const chipOn = "border-accent bg-accent/12 font-semibold text-accent-bright";

async function create(event: SubmitEvent) {
  event.preventDefault();
  submitting = true;
  error = null;
  try {
    await api("/api/sandboxes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        cpu,
        memoryGib: memory,
        gpu,
        gpuCount,
        image,
        volumes,
      }),
    });
    open = false;
    name = "";
    volumes = [{ name: "", mount: "" }];
    oncreated();
  } catch (e) {
    error = e instanceof ApiError ? e.message : String(e);
  } finally {
    submitting = false;
  }
}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />
		<Dialog.Content
			class="bg-drawer text-ink fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-white/10 focus:outline-none"
		>
			<form onsubmit={create} class="flex h-full min-h-0 flex-col">
				<div class="flex items-start justify-between border-b border-white/8 px-[22px] pt-5 pb-4">
					<div class="flex flex-col gap-[5px]">
						<Dialog.Title class="text-[17px] leading-[1.1] font-semibold tracking-[-0.2px]">
							Create sandbox
						</Dialog.Title>
						<Dialog.Description class="text-secondary text-xs leading-[1.4]">
							Runs in {workspace} · first launch of a base image builds the runtime (~2 min)
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
							placeholder="my-sandbox"
							data-1p-ignore
							data-lpignore="true"
							pattern="[a-z0-9][a-z0-9\-]*"
							class="focus:border-accent/45 rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px]
								font-mono text-[13px] focus:bg-white/3 focus:outline-none"
						/>
						<span class="text-muted text-[11px] leading-[1.5]">
							The name is also the state identity: creating a sandbox with a previous name
							resumes its /workspace, agent logins and installed toolchains.
						</span>
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
						<div class="text-muted flex justify-between font-mono text-[10.5px]">
							<span>{memoryRange.min} GiB</span>
							<span>{memoryRange.max} GiB</span>
						</div>
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
							<span class="text-label text-[11.5px] font-medium">GPU count</span>
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
					</div>

					<div class="flex flex-col gap-[9px]">
						<span class="text-label text-[11.5px] font-medium">Base image</span>
						<Select.Root type="single" bind:value={image}>
							<Select.Trigger
								class="flex w-full cursor-pointer items-center gap-[10px] rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px] font-mono text-[12.5px]"
							>
								{image}
								<span class="text-faint ml-auto text-[9px]">▼</span>
							</Select.Trigger>
							<Select.Portal>
								<Select.Content
									class="bg-overlay shadow-overlay z-50 rounded-[9px] border border-white/12 p-[5px]"
									sideOffset={6}
								>
									{#each imageOptions as option (option)}
										<Select.Item
											value={option}
											label={option}
											class="text-control data-highlighted:bg-white/6 data-selected:text-accent-bright cursor-pointer rounded-md px-[9px] py-[9px] font-mono text-[12.5px]"
										>
											{option}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					</div>

					<div class="flex flex-col gap-[9px]">
						<span class="text-label text-[11.5px] font-medium">Volume mounts</span>
						<!-- Built-in state mount: every sandbox gets it, shown for truth, not editable -->
						<div class="flex items-center gap-2 opacity-60">
							<input
								value={`qook-state/sandboxes/${name.trim() || 'my-sandbox'}/workspace`}
								disabled
								class="w-0 flex-1 rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px] font-mono text-xs"
							/>
							<span class="text-muted font-mono text-xs">→</span>
							<input
								value="/workspace"
								disabled
								class="w-0 flex-[1.4] rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px] font-mono text-xs"
							/>
							<span
								class="text-muted flex h-[26px] flex-none items-center px-[2px] text-[10px] whitespace-nowrap"
							>
								built-in
							</span>
						</div>
						{#each volumes as volume, i (i)}
							<div class="flex items-center gap-2">
								<input
									bind:value={volume.name}
									autocomplete="off"
									spellcheck="false"
									placeholder="datasets"
									class="focus:border-accent/45 w-0 flex-1 rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px] font-mono text-xs focus:outline-none"
								/>
								<span class="text-muted font-mono text-xs">→</span>
								<input
									bind:value={volume.mount}
									autocomplete="off"
									spellcheck="false"
									placeholder="/mnt/datasets"
									class="focus:border-accent/45 w-0 flex-[1.4] rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px] font-mono text-xs focus:outline-none"
								/>
								<button
									type="button"
									aria-label="Remove volume mount"
									onclick={() => {
										volumes.splice(i, 1);
										if (volumes.length === 0) volumes.push({ name: "", mount: "" });
									}}
									class="text-faint hover:text-control flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-[5px] border border-white/10 text-xs hover:bg-white/5"
								>
									✕
								</button>
							</div>
						{/each}
						<div class="flex items-center justify-between">
							<button
								type="button"
								onclick={() => (builtinsOpen = !builtinsOpen)}
								class="text-muted hover:text-secondary flex cursor-pointer items-center gap-[6px] text-[11px] leading-[1.5]"
							>
								<span class="text-[9px]">{builtinsOpen ? '▾' : '▸'}</span>
								{builtinMounts.length - 1} more paths persist on the built-in mount
							</button>
							{#if volumes.length < maxVolumeMounts}
								<button
									type="button"
									onclick={() => volumes.push({ name: "", mount: "" })}
									class="text-control flex-none cursor-pointer rounded-[5px] border border-white/12 px-[9px] py-[5px] text-[11px] leading-none font-medium whitespace-nowrap hover:bg-white/5"
								>
									+ Add volume
								</button>
							{/if}
						</div>
						{#if builtinsOpen}
							<div class="flex flex-col gap-[7px] rounded-[7px] border border-white/8 bg-white/2 p-[11px]">
								<span class="section-label">
									BUILT-IN · qook-state/sandboxes/{name.trim() || 'my-sandbox'}/
								</span>
								{#each builtinMounts as m (m.sub)}
									<span
										class="text-data flex items-center gap-2 font-mono text-[10.5px] leading-none whitespace-nowrap"
									>
										{m.sub}
										<span class="text-muted">→</span>
										<span class="text-control">{m.target}</span>
									</span>
								{/each}
							</div>
						{/if}
					</div>

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
						disabled={submitting}
						class="bg-accent text-canvas cursor-pointer rounded-[7px] px-[18px] py-[10px] text-[12.5px] font-semibold disabled:opacity-60"
					>
						{submitting ? "Creating…" : "Create"}
					</button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
