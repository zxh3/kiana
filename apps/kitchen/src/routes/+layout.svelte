<script lang="ts">
import { navigating } from "$app/state";
import CommandPalette from "$lib/components/CommandPalette.svelte";
import ShortcutsPanel from "$lib/components/ShortcutsPanel.svelte";
import { bindHotkeys, HELP_KEY, PALETTE_KEY } from "$lib/hotkeys";
import { palette } from "$lib/palette.svelte";
import { shortcutsPanel } from "$lib/shortcutsPanel.svelte";
import "../app.css";

let { children, data } = $props();

// The two global bindings; everything else belongs to the screen that owns it.
// The palette needs credentials to list anything, so on Settings — the one
// screen reachable without them — the key stays inert rather than opening an
// empty palette.
$effect(() =>
  bindHotkeys([
    [HELP_KEY, () => (shortcutsPanel.open = !shortcutsPanel.open)],
    [
      PALETTE_KEY,
      () => {
        if (data.connection) palette.open = !palette.open;
      },
    ],
  ]),
);

// Entering a sandbox loads its session (tunnels plus a readiness probe per
// pane), which is most of a second before SvelteKit renders anything. Without
// a signal here the click looks lost, so every navigation gets one.
const routing = $derived(Boolean(navigating.to));
</script>

<svelte:head>
	<title>kitchen</title>
</svelte:head>

{#if routing}
	<div class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] overflow-hidden">
		<div class="route-progress bg-accent h-full w-full"></div>
	</div>
{/if}

{@render children()}

<ShortcutsPanel bind:open={shortcutsPanel.open} />
{#if data.connection}
	<CommandPalette workspace={data.connection.workspace} />
{/if}
