<script lang="ts">
import "../app.css";

let { children } = $props();
</script>

<svelte:head>
	<title>kitchen</title>
</svelte:head>

{@render children()}
