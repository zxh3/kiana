/**
 * The qook sandbox runtime: what turns a bare base image into a sandbox
 * with working bash / herdr / vscode panes.
 *
 * Two halves:
 *  - `runtimeCommands` — image layers appended to every base image. Modal
 *    caches built images by layer content, so keep these deterministic
 *    (pinned versions) or every sandbox launch pays a rebuild.
 *  - `bootScript` — the sandbox entrypoint, passed as the create command.
 *    It carries no secrets in the image: the per-sandbox auth secret arrives
 *    via the QOOK_SECRET env var at launch. If any service dies, the
 *    script exits nonzero so the status reconciler reports the sandbox as
 *    failed.
 *
 * Auth model: Caddy owns the public tunnel ports and fronts every service
 * (which bind to localhost only). The console points each pane's iframe at
 * /qook-auth?token=<secret>; Caddy answers with an HttpOnly cookie and a
 * redirect, and everything after that — including WebSockets — must carry
 * the cookie. No long-lived secret sits in a URL.
 */

const TTYD_VERSION = "1.7.7";
const CODE_SERVER_VERSION = "4.133.0";
const CADDY_VERSION = "2.11.4";

import { modePorts } from "$lib/types";

/** Caddy proxies each public port to the service on localhost. */
export { modePorts };
export const runtimePorts = Object.values(modePorts);

/** Mount point of the per-sandbox state volume. Everything under it survives restarts. */
export const STATE_MOUNT = "/qook-state";
/** The working directory shells and code-server open in; symlinked onto the state volume. */
export const WORKSPACE_DIR = "/workspace";
/** Paths the runtime owns; user volume mounts may not collide with these. */
export const reservedMountPaths = [STATE_MOUNT, WORKSPACE_DIR];

export const runtimeCommands = [
  "RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl ca-certificates git && rm -rf /var/lib/apt/lists/*",
  `RUN curl -fsSL https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64 -o /usr/local/bin/ttyd && chmod +x /usr/local/bin/ttyd`,
  `RUN curl -fsSL https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz | tar -xz -C /usr/local/bin caddy`,
  `RUN curl -fsSL https://code-server.dev/install.sh | sh -s -- --method=standalone --version=${CODE_SERVER_VERSION}`,
  "RUN curl -fsSL https://herdr.dev/install.sh | sh",
  // agent CLIs, preinstalled so herdr detects them out of the box. Modal
  // caches this layer on first build, freezing whatever versions npm
  // resolved then — bump the trailing comment to force a refresh.
  "RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y --no-install-recommends nodejs && rm -rf /var/lib/apt/lists/*",
  "RUN npm install -g @anthropic-ai/claude-code @openai/codex @earendil-works/pi-coding-agent # agents-v1",
  // the installers drop binaries in /root/.local/bin, which login shells don't have on PATH
  "RUN ln -sf /root/.local/bin/herdr /root/.local/bin/code-server /usr/local/bin/",
  // code-server defaults: dark theme, no telemetry, no trust prompts
  `RUN mkdir -p /root/.local/share/code-server/User && printf '%s' '{"workbench.colorTheme":"Default Dark Modern","security.workspace.trust.enabled":false,"telemetry.telemetryLevel":"off","workbench.startupEditor":"none"}' > /root/.local/share/code-server/User/settings.json`,
  // zsh + oh-my-zsh as the default shell, with git + autosuggestions plugins.
  // ZSH_THEME stays empty: the qook prompt is set at boot (/etc/qook-zshrc).
  "RUN apt-get update && apt-get install -y --no-install-recommends zsh && rm -rf /var/lib/apt/lists/* && chsh -s /usr/bin/zsh root",
  'RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended',
  "RUN git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions /root/.oh-my-zsh/custom/plugins/zsh-autosuggestions",
  `RUN printf '%s\\n' 'export ZSH="$HOME/.oh-my-zsh"' 'ZSH_THEME="robbyrussell"' 'ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=241"' 'plugins=(git zsh-autosuggestions)' 'zstyle ":omz:alpha:lib:git" async-prompt no' 'source $ZSH/oh-my-zsh.sh' '[ -f /etc/qook-zshrc ] && source /etc/qook-zshrc' > /root/.zshrc`,
];

// NOTE: written to avoid \`${\` entirely — JS template interpolation would
// otherwise swallow the shell's own expansions.
export const bootScript = String.raw`
set -u
[ -n "$QOOK_SECRET" ] || { echo "QOOK_SECRET not set" >&2; exit 1; }
[ -n "$QOOK_SANDBOX_NAME" ] || QOOK_SANDBOX_NAME=sandbox
export PATH="/root/.local/bin:$PATH"
export SHELL=/usr/bin/zsh
# herdr state lives on the volume, but volumes can't host unix sockets —
# keep the socket on local disk.
export HERDR_SOCKET_PATH=/tmp/herdr.sock

# --- persistent state: volume mounted at /qook-state ---
mkdir -p /qook-state/workspace /qook-state/herdr/config /qook-state/herdr/share /qook-state/herdr/state
ln -sfn /qook-state/workspace /workspace
mkdir -p /root/.config /root/.local/share /root/.local/state
ln -sfn /qook-state/herdr/config /root/.config/herdr
ln -sfn /qook-state/herdr/share /root/.local/share/herdr
ln -sfn /qook-state/herdr/state /root/.local/state/herdr

# --- agent state: claude code, codex and pi persist across restarts ---
mkdir -p /qook-state/agents/claude /qook-state/agents/codex /qook-state/agents/pi
export CLAUDE_CONFIG_DIR=/qook-state/agents/claude
export CODEX_HOME=/qook-state/agents/codex
ln -sfn /qook-state/agents/pi /root/.pi
export HISTFILE=/qook-state/bash_history

# --- toolchains: rustup/cargo and npm -g land on the volume, so they persist ---
mkdir -p /qook-state/tools/cargo /qook-state/tools/rustup /qook-state/tools/npm
export CARGO_HOME=/qook-state/tools/cargo
export RUSTUP_HOME=/qook-state/tools/rustup
export NPM_CONFIG_PREFIX=/qook-state/tools/npm
export PATH="/qook-state/tools/cargo/bin:/qook-state/tools/npm/bin:$PATH"

# name marker for the in-sandbox qook command
printf '%s' "$QOOK_SANDBOX_NAME" > /etc/qook-name

# herdr: replay recent pane contents after restarts (config lives on the
# volume; only seed it once so user edits stick)
if [ ! -f /qook-state/herdr/config/config.toml ]; then
	printf '[terminal]\ndefault_shell = "zsh"\n\n[experimental]\npane_history = true\n' > /qook-state/herdr/config/config.toml
fi

# code-server: extensions and user state (settings, keybindings, UI state)
# persist on the volume. Only these two subdirs — the data-dir root holds
# code-server's IPC socket, and sockets can't live on a volume. The image's
# baked settings.json seeds the volume copy once.
CODESERVER=/root/.local/share/code-server
mkdir -p /qook-state/code-server/extensions /qook-state/code-server/user
if [ ! -f /qook-state/code-server/user/settings.json ] && [ -f "$CODESERVER/User/settings.json" ]; then
	cp "$CODESERVER/User/settings.json" /qook-state/code-server/user/settings.json
fi
rm -rf "$CODESERVER/User" "$CODESERVER/extensions"
mkdir -p "$CODESERVER"
ln -sfn /qook-state/code-server/user "$CODESERVER/User"
ln -sfn /qook-state/code-server/extensions "$CODESERVER/extensions"

# --- prompt (root's .bashrc would otherwise override profile.d) ---
cat > /etc/profile.d/qook.sh <<PROFILE
export PS1='\[\e[38;5;191m\]qook@'$QOOK_SANDBOX_NAME'\[\e[0m\]:\[\e[38;5;110m\]\w\[\e[0m\]$ '
export PATH="/qook-state/tools/cargo/bin:/qook-state/tools/npm/bin:/root/.local/bin:\$PATH"
export HERDR_SOCKET_PATH=/tmp/herdr.sock
export CLAUDE_CONFIG_DIR=/qook-state/agents/claude
export CODEX_HOME=/qook-state/agents/codex
export HISTFILE=/qook-state/bash_history
export CARGO_HOME=/qook-state/tools/cargo
export RUSTUP_HOME=/qook-state/tools/rustup
export NPM_CONFIG_PREFIX=/qook-state/tools/npm
case \$- in *i*)
	if [ -z "\$QOOK_MOTD_SHOWN" ]; then
		export QOOK_MOTD_SHOWN=1
		printf '\e[90m/workspace, agent logins and installed toolchains persist across restarts of $QOOK_SANDBOX_NAME.\neverything else resets on terminate. type \e[0mqook\e[90m for details.\e[0m\n'
	fi
;; esac
PROFILE
echo '[ -f /etc/profile.d/qook.sh ] && . /etc/profile.d/qook.sh' >> /root/.bashrc

# --- the in-sandbox reference: what persists, what resets ---
cat > /usr/local/bin/qook <<'QOOKCMD'
#!/bin/sh
NAME=$(cat /etc/qook-name 2>/dev/null || echo sandbox)
printf '\033[1mqook\033[0m - sandbox \033[1m%s\033[0m\n\n' "$NAME"
printf 'persists across restarts of %s (volume qook-state/sandboxes/%s):\n' "$NAME" "$NAME"
printf '  /workspace                      your files\n'
printf '  herdr sessions                  ~/.config|share|state/herdr\n'
printf '  vscode settings + extensions    code-server User/ and extensions/\n'
printf '  agent logins + sessions         claude / codex / pi\n'
printf '  shell history\n\n'
printf 'installs that land on the volume, so they persist too:\n'
if command -v cargo >/dev/null 2>&1; then
	printf '  rust                            installed (%s) - persisted\n' "$(cargo --version | cut -d' ' -f2)"
else
	printf '  rust                            not installed. to install (persists):\n'
	printf '                                  curl -fsSL https://sh.rustup.rs | sh -s -- -y\n'
fi
printf '  npm -g <pkg>                    global installs are volume-backed\n\n'
printf 'browser tab:\n'
printf '  proxies to port 3000 in this sandbox - start any dev server there\n\n'
printf 'resets on terminate:\n'
printf '  apt/system packages, $HOME dotfiles, anything outside the paths above\n'
printf '  tip: keep other toolchains under /workspace or /qook-state/tools\n'
QOOKCMD
chmod +x /usr/local/bin/qook

# --- zsh: env for every invocation, plus the qook prompt + MOTD ---
cat > /etc/zsh/zshenv <<ZSHENV
export PATH="/qook-state/tools/cargo/bin:/qook-state/tools/npm/bin:/root/.local/bin:\$PATH"
export HERDR_SOCKET_PATH=/tmp/herdr.sock
export CLAUDE_CONFIG_DIR=/qook-state/agents/claude
export CODEX_HOME=/qook-state/agents/codex
export CARGO_HOME=/qook-state/tools/cargo
export RUSTUP_HOME=/qook-state/tools/rustup
export NPM_CONFIG_PREFIX=/qook-state/tools/npm
export SHELL=/usr/bin/zsh
ZSHENV

cat > /etc/qook-zshrc <<QOOKZSH
export HISTFILE=/qook-state/zsh_history
export HISTSIZE=10000
export SAVEHIST=10000
setopt share_history
if [ -z "\$QOOK_MOTD_SHOWN" ]; then
	export QOOK_MOTD_SHOWN=1
	printf '\e[90m/workspace, agent logins and installed toolchains persist across restarts of $QOOK_SANDBOX_NAME.\neverything else resets on terminate. type \e[0mqook\e[90m for details.\e[0m\n'
fi
QOOKZSH

# --- auth proxy: cookie exchange in front of every service ---
cat > /tmp/Caddyfile <<CADDYEOF
{
	admin off
	auto_https off
}
(qookauth) {
	@login {
		path /qook-auth
		query token=$QOOK_SECRET
	}
	handle @login {
		header Set-Cookie "qook=$QOOK_SECRET; Path=/; Secure; HttpOnly; SameSite=None"
		redir * / 302
	}
	@authed {
		header Cookie *qook=$QOOK_SECRET*
	}
	handle @authed {
		reverse_proxy 127.0.0.1:{args[0]}
	}
	handle {
		respond "qook: authentication required" 403
	}
}
:7681 {
	import qookauth 17681
}
:7683 {
	import qookauth 17683
}
:8443 {
	import qookauth 18443
}
:8080 {
	import qookauth 3000
	handle_errors {
		respond "qook: nothing is listening on port 3000 in this sandbox yet. start your app on port 3000 and reload this tab." 502
	}
}
CADDYEOF

cd /workspace
TTYD_THEME='{"background":"#0a0a0b","foreground":"#c9c9cf","cursor":"#c6f24e","selectionBackground":"#3a3a2e"}'
ttyd -p 17681 -i 127.0.0.1 -W -t "theme=$TTYD_THEME" -t fontSize=13 zsh &
ttyd -p 17683 -i 127.0.0.1 -W -t "theme=$TTYD_THEME" -t fontSize=13 herdr &
code-server --bind-addr 127.0.0.1:18443 --auth none --disable-telemetry /workspace &
caddy run --config /tmp/Caddyfile --adapter caddyfile &

# fail the sandbox loudly if any service dies
wait -n
echo "qook boot: a service exited" >&2
exit 1
`;
