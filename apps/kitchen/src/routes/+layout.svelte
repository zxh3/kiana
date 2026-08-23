<script lang="ts">
import { navigating } from "$app/state";
import "../app.css";

let { children } = $props();

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
