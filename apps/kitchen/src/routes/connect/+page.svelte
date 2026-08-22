<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { ApiError, api } from "$lib/api";
import { clearCredentials, loadCredentials, saveCredentials } from "$lib/creds";

import {
  type ConnectionInfo,
  defaultRetentionDays,
  type RetentionDays,
  retentionOptions,
} from "$lib/types";

const stored = loadCredentials();
/** Where the credentials in force actually come from, and which env they use. */
const active = $derived(page.data.connection as ConnectionInfo | null);
let tokenId = $state(stored?.tokenId ?? "");
let tokenSecret = $state(stored?.tokenSecret ?? "");
let environment = $state(stored?.environment ?? "");
let submitting = $state(false);
let error = $state<string | null>(null);

async function connect(event: SubmitEvent) {
  event.preventDefault();
  submitting = true;
  error = null;
  try {
    const headers: Record<string, string> = {
      "x-modal-token-id": tokenId.trim(),
      "x-modal-token-secret": tokenSecret.trim(),
    };
    if (environment.trim()) headers["x-modal-environment"] = environment.trim();
    const connection = await api<ConnectionInfo>("/api/connection", {
      headers,
    });
    saveCredentials({
      tokenId: tokenId.trim(),
      tokenSecret: tokenSecret.trim(),
      environment: environment.trim() || undefined,
      workspace: connection.workspace,
    });
    await goto("/");
  } catch (e) {
    error = e instanceof ApiError ? e.message : String(e);
  } finally {
    submitting = false;
  }
}

function disconnect() {
  clearCredentials();
  tokenId = "";
  tokenSecret = "";
  environment = "";
}

// Retention applies to *new* automatic snapshots: a snapshot's lifetime is
// fixed when it is taken, so changing this never shortens or extends one that
// already exists.
// The retention policy lives in the workspace, not the browser: two people
// should not be able to disagree about how long new snapshots last.
let retentionDays = $state<RetentionDays | null | undefined>(undefined);
let savingRetention = $state(false);

$effect(() => {
  void (async () => {
    try {
      const settings = await api<{ retentionDays: RetentionDays }>(
        "/api/settings",
      );
      retentionDays = settings.retentionDays;
    } catch {
      retentionDays = defaultRetentionDays;
    }
  })();
});

async function setRetention(days: RetentionDays) {
  const previous = retentionDays;
  retentionDays = days;
  savingRetention = true;
  try {
    await api("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retentionDays: days }),
    });
  } catch (e) {
    retentionDays = previous;
    error = e instanceof ApiError ? e.message : String(e);
  } finally {
    savingRetention = false;
  }
}
</script>

<svelte:head>
	<title>connect · kitchen</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center p-9">
	<form onsubmit={connect} class="flex w-full max-w-[488px] flex-col gap-5">
		<div class="flex items-center gap-[9px]">
			<span class="bg-accent size-4 rounded-[3px]"></span>
			<span class="text-ink font-mono text-[14px] font-semibold tracking-[-0.2px]">kitchen</span>
		</div>
		<div class="flex flex-col gap-[7px]">
			<h1 class="text-[19px] leading-[1.2] font-semibold tracking-[-0.3px]">
				Connect your Modal account
			</h1>
			<p class="text-body text-[12.5px] leading-[1.6] text-pretty">
				Create a token in Modal and paste both halves. Sandboxes run and are billed in your
				Modal workspace.
			</p>
		</div>

		<label class="flex flex-col gap-2">
			<span class="text-label text-[11.5px] font-medium">Token ID</span>
			<input
				bind:value={tokenId}
				required
				autocomplete="off"
				spellcheck="false"
				placeholder="ak-…"
				class="focus:border-accent/45 rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px] font-mono
					text-[12.5px] focus:bg-white/3 focus:outline-none"
			/>
		</label>

		<label class="flex flex-col gap-2">
			<span class="text-label text-[11.5px] font-medium">Token secret</span>
			<input
				bind:value={tokenSecret}
				required
				type="password"
				autocomplete="off"
				placeholder="as-…"
				class="focus:border-accent/45 rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px] font-mono
					text-[12.5px] focus:bg-white/3 focus:outline-none"
			/>
		</label>

		<label class="flex flex-col gap-2">
			<span class="text-label text-[11.5px] font-medium">Environment</span>
			<input
				bind:value={environment}
				autocomplete="off"
				spellcheck="false"
				placeholder="main"
				class="focus:border-accent/45 rounded-[7px] border border-white/10 bg-white/2 px-3 py-[10px] font-mono
					text-[12.5px] focus:bg-white/3 focus:outline-none"
			/>
			<span class="text-muted text-[11px] leading-[1.5]">
				Optional — the Modal environment sandboxes run in. Leave empty for your workspace
				default.
			</span>
		</label>

		{#if error}
			<div
				class="border-failed/28 bg-failed/6 flex items-center gap-[9px] rounded-lg border px-[13px] py-[11px]"
			>
				<span class="bg-failed size-[6px] shrink-0 rounded-full"></span>
				<span class="text-failed-text text-xs leading-[1.4]">{error}</span>
			</div>
		{/if}

		<div class="flex items-center gap-3">
			<button
				type="submit"
				disabled={submitting}
				class="bg-accent text-canvas cursor-pointer rounded-[7px] px-4 py-[10px] text-[12.5px] font-semibold disabled:opacity-60"
			>
				{submitting ? "Verifying…" : "Connect"}
			</button>
			{#if stored}
				<button
					type="button"
					onclick={disconnect}
					class="text-control cursor-pointer rounded-[7px] border border-white/12 px-[14px] py-[10px] text-[12.5px] font-medium hover:bg-white/5"
				>
					Disconnect
				</button>
			{/if}
		</div>

		{#if active}
			<div class="flex flex-col gap-[6px] rounded-lg border border-white/10 bg-white/2 px-[13px] py-[11px]">
				<span class="text-label text-[11px] font-medium">Currently using</span>
				<span class="text-control font-mono text-[12px] leading-none">
					{active.workspace}{active.environment ? ` / ${active.environment}` : ' / (workspace default)'}
				</span>
				<span class="text-muted text-[11px] leading-[1.6]">
					{active.source === 'server'
						? 'Credentials come from this deployment, not from your browser. Sandboxes, volumes and snapshots all live in the environment above. Entering a token below would use your own Modal account in this browser instead.'
						: 'Credentials from this browser. Sandboxes, volumes and snapshots all live in the environment above.'}
				</span>
			</div>
		{/if}

		<p class="text-muted text-[11px] leading-[1.6] text-pretty">
			Credentials are stored only in this browser (localStorage) — nothing is saved
			server-side. Anyone with access to this browser profile can read them; disconnect to
			clear them.
		</p>

		<div class="flex flex-col gap-[9px] border-t border-white/8 pt-5">
			<span class="text-label text-[11.5px] font-medium">Keep automatic snapshots for</span>
			<div class="flex gap-[7px]">
				{#each retentionOptions as option (option.label)}
					<button
						type="button"
						onclick={() => setRetention(option.days)}
						disabled={savingRetention || retentionDays === undefined}
						class="flex-1 cursor-pointer rounded-md border py-[9px] text-center font-mono text-xs disabled:opacity-60
							{retentionDays === option.days
							? 'border-accent bg-accent/12 text-accent-bright font-semibold'
							: 'text-data border-white/10 hover:border-white/20'}"
					>
						{option.label}
					</button>
				{/each}
			</div>
			<p class="text-muted text-[11px] leading-[1.6] text-pretty">
				Stopping a sandbox saves the whole machine as a snapshot. Automatic ones expire
				after this long; the ones you <span class="text-secondary">Keep</span> are held until
				you delete them. This is a workspace setting — everyone using these credentials
				gets it — and it applies to new snapshots, since a snapshot's lifetime is fixed
				when it is saved.
			</p>
		</div>
	</form>
</div>
