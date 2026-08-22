<script lang="ts">
let { size = 16 }: { size?: number } = $props();
</script>

<span class="flex items-center gap-[9px]">
	<span class="bg-accent rounded-[3px]" style="width:{size}px;height:{size}px"></span>
	<span class="text-ink font-mono font-semibold tracking-[-0.2px]" style="font-size:{size - 2}px">
		qook
	</span>
</span>
