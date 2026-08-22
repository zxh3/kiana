import type { SandboxSpec } from "$lib/server/modal";
import { reservedMountPaths } from "$lib/server/runtime";
import {
  cpuOptions,
  gpuCountOptions,
  gpuOptions,
  imageOptions,
  maxVolumeMounts,
  memoryRange,
  type VolumeMount,
} from "$lib/types";

type Result = { ok: true; spec: SandboxSpec } | { ok: false; error: string };

/** Validate an untrusted create-sandbox payload into a SandboxSpec. */
// biome-ignore lint/suspicious/noExplicitAny: untrusted input
export function validateSpec(body: any): Result {
  const name = String(body?.name ?? "").trim();
  const cpu = Number(body?.cpu);
  const memoryGib = Number(body?.memoryGib);
  const gpuRaw = String(body?.gpu ?? "none");
  const gpuCountRaw = Number(body?.gpuCount ?? 1);
  const image = String(body?.image ?? "");
  const rawVolumes = Array.isArray(body?.volumes) ? body.volumes : [];

  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(name)) {
    return {
      ok: false,
      error:
        "Names are lowercase letters, digits and dashes, up to 32 characters.",
    };
  }
  if (!cpuOptions.includes(cpu as (typeof cpuOptions)[number])) {
    return { ok: false, error: "Pick a CPU size from the listed options." };
  }
  if (
    !Number.isInteger(memoryGib) ||
    memoryGib < memoryRange.min ||
    memoryGib > memoryRange.max
  ) {
    return {
      ok: false,
      error: `Memory must be between ${memoryRange.min} and ${memoryRange.max} GiB.`,
    };
  }
  if (!gpuOptions.includes(gpuRaw as (typeof gpuOptions)[number])) {
    return { ok: false, error: "Pick a GPU from the listed options." };
  }
  if (
    !gpuCountOptions.includes(gpuCountRaw as (typeof gpuCountOptions)[number])
  ) {
    return { ok: false, error: "Pick a GPU count from the listed options." };
  }
  if (!imageOptions.includes(image as (typeof imageOptions)[number])) {
    return { ok: false, error: "Pick a base image from the list." };
  }

  const volumes: VolumeMount[] = [];
  for (const raw of rawVolumes) {
    const vName = String(raw?.name ?? "").trim();
    const mount = String(raw?.mount ?? "").trim();
    if (!vName && !mount) continue; // empty row
    if (!vName || !mount) {
      return {
        ok: false,
        error: "A volume mount needs both a volume name and a mount path.",
      };
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(vName)) {
      return {
        ok: false,
        error: `Volume name ${vName} is invalid — letters, digits, dots, dashes and underscores only.`,
      };
    }
    if (!mount.startsWith("/")) {
      return { ok: false, error: "Mount paths are absolute — start with /." };
    }
    if (
      reservedMountPaths.some(
        (reserved) => mount === reserved || mount.startsWith(`${reserved}/`),
      )
    ) {
      return {
        ok: false,
        error: `${mount} is reserved for the sandbox runtime — pick another mount path.`,
      };
    }
    if (volumes.some((v) => v.mount === mount)) {
      return {
        ok: false,
        error: `Two volumes point at ${mount} — mount paths must be unique.`,
      };
    }
    volumes.push({ name: vName, mount });
  }
  if (volumes.length > maxVolumeMounts) {
    return {
      ok: false,
      error: `At most ${maxVolumeMounts} volume mounts per sandbox.`,
    };
  }

  const gpu = gpuRaw === "none" ? null : gpuRaw;
  return {
    ok: true,
    spec: {
      name,
      image,
      cpu,
      memoryGib,
      gpu,
      gpuCount: gpu ? gpuCountRaw : 1,
      volumes,
    },
  };
}
