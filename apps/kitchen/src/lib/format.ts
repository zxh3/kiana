export function formatUptime(
  createdAt: Date | string | null,
  now = Date.now(),
): string {
  if (!createdAt) return "—";
  const ms = now - new Date(createdAt).getTime();
  const m = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export function formatAgo(
  date: Date | string | null,
  now = Date.now(),
): string {
  if (!date) return "";
  const ms = now - new Date(date).getTime();
  const m = Math.max(1, Math.floor(ms / 60_000));
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

export function formatResources(sb: {
  cpu: number;
  memoryGib: number;
  gpu: string | null;
  gpuCount: number;
}): string {
  const gpu = sb.gpu
    ? sb.gpuCount > 1
      ? `${sb.gpu}:${sb.gpuCount}`
      : sb.gpu
    : "—";
  return `${sb.cpu} vCPU · ${sb.memoryGib} GiB · ${gpu}`;
}
