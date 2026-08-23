<script lang="ts">
import { Dialog } from "bits-ui";
import { displayKeys, type Shortcut, shortcuts } from "$lib/hotkeys";

let { open = $bindable(false) }: { open?: boolean } = $props();

const scopes: Shortcut["scope"][] = ["Anywhere", "Sandboxes", "In a sandbox"];
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />
		<Dialog.Content
			class="bg-drawer text-ink fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] flex-col border-l border-white/10 focus:outline-none"
		>
			<div class="flex items-start justify-between border-b border-white/8 px-[22px] pt-5 pb-4">
				<div class="flex flex-col gap-[5px]">
					<Dialog.Title class="text-[17px] leading-[1.1] font-semibold tracking-[-0.2px]">
						Keyboard shortcuts
					</Dialog.Title>
					<Dialog.Description class="text-secondary text-xs leading-[1.5]">
						Press <kbd class="text-control font-mono">?</kbd> anywhere to open this
					</Dialog.Description>
				</div>
				<Dialog.Close
					class="text-body flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-md border border-white/12 text-xs hover:bg-white/5"
					aria-label="Close"
				>
					✕
				</Dialog.Close>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-[22px] py-5">
				{#each scopes as scope (scope)}
					{@const inScope = shortcuts.filter((s) => s.scope === scope)}
					{#if inScope.length > 0}
						<div class="flex flex-col gap-[10px]">
							<span class="section-label">{scope.toUpperCase()}</span>
							{#each inScope as shortcut (shortcut.keys)}
								<div class="flex items-baseline justify-between gap-4">
									<span class="text-body text-[12.5px] leading-none">{shortcut.label}</span>
									<kbd
										class="text-data flex-none rounded-[5px] border border-white/14 bg-white/3 px-[7px] py-[3px] font-mono text-[11px] leading-none"
									>
										{displayKeys(shortcut.keys)}
									</kbd>
								</div>
							{/each}
						</div>
					{/if}
				{/each}

				<p class="text-muted text-[11px] leading-[1.6]">
					A pane is a cross-origin iframe, so while your cursor is inside the terminal or
					editor its keystrokes belong to it — including these. Click the session bar to hand
					focus back to the console.
				</p>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
