<script lang="ts">
import type { SandboxStatus } from "$lib/types";

let {
  status,
  label,
  size = 6,
}: { status: SandboxStatus; label?: string; size?: number } = $props();

const dot: Record<SandboxStatus, string> = {
  running: "bg-running",
  stopped: "bg-stopped",
  failed: "bg-failed",
};
const text: Record<SandboxStatus, string> = {
  running: "text-running-text",
  stopped: "text-body",
  failed: "text-failed-text",
};
const defaultLabel: Record<SandboxStatus, string> = {
  running: "Running",
  stopped: "Stopped",
  failed: "Failed",
};
</script>

<span class="flex items-center gap-[7px] whitespace-nowrap">
	<span
		class="rounded-full {dot[status]} {status === 'running' ? 'halo-running' : ''}"
		style="width:{size}px;height:{size}px"
	></span>
	<span class="text-xs font-medium {text[status]}">{label ?? defaultLabel[status]}</span>
</span>
