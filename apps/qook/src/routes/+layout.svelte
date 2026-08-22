<script lang="ts">
import "../app.css";

let { children } = $props();
</script>

<svelte:head>
	<title>qook</title>
</svelte:head>

{@render children()}
