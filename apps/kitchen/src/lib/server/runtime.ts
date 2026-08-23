/**
 * The kitchen sandbox runtime: what turns a bare base image into a sandbox
 * with working zsh / herdr / vscode / browser panes.
 *
 * Persistence is NOT wired up here. A sandbox is its filesystem, and snapshots
 * (see server/snapshots.ts) capture that filesystem whole — so tools
 * live where tools normally live, and anything installed anywhere survives.
 * Volumes are a user-visible option, never a runtime mechanism.
 *
 * Two halves:
 *  - `runtimeCommands` — image layers appended to every base image. Modal
 *    caches built images by layer content, so keep these deterministic
 *    (pinned versions) or every sandbox launch pays a rebuild.
 *  - `bootScript` — the sandbox entrypoint, passed as the create command.
 *    It carries no secrets in the image: the per-sandbox auth secret arrives
 *    via the KITCHEN_SECRET env var at launch. If any service dies, the
 *    script exits nonzero so the status reconciler reports the sandbox as
 *    failed.
 *
 * Auth model: Caddy owns the public tunnel ports and fronts every service
 * (which bind to localhost only). The console points each pane's iframe at
 * /kitchen-auth?token=<secret>; Caddy answers with an HttpOnly cookie and a
 * redirect, and everything after that — including WebSockets — must carry
 * the cookie. No long-lived secret sits in a URL.
 */

// ttyd's last release (1.7.7, 2024) predates xterm.js's clipboard addon, so
// OSC 52 copies — how herdr's copy-on-select reaches the browser clipboard —
// were silently dropped. Master bundles the addon and commits a prebuilt web
// UI (src/html.h), so it builds from source with cmake alone. Pinned commit.
const TTYD_COMMIT = "2922cb89f518bae4d0fcf4d757a7419638fc71fc";

/**
 * Bump when `runtimeCommands` changes in a way an existing sandbox would care
 * about (new binary versions, new preinstalled tooling). Snapshots record
 * it, so the UI can tell that a restored sandbox is on an older runtime and
 * offer to rebuild. The boot script is passed at create time, so changes there
 * need no bump — they apply on the next start.
 *
 * Mirrored in $lib/runtimeVersion.ts for the client; keep the two in step.
 */
export const RUNTIME_VERSION = 3;
const CODE_SERVER_VERSION = "4.133.0";
const UV_VERSION = "0.12.5";
const CADDY_VERSION = "2.11.4";

import { modePorts, WORKSPACE_DIR } from "$lib/types";

/** Caddy proxies each public port to the service on localhost. */
export { modePorts };
export const runtimePorts = Object.values(modePorts);
export { WORKSPACE_DIR };

export const runtimeCommands = [
  "RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl ca-certificates git && rm -rf /var/lib/apt/lists/*",
  `RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential cmake libjson-c-dev libwebsockets-dev && curl -fsSL https://github.com/tsl0922/ttyd/archive/${TTYD_COMMIT}.tar.gz | tar -xz -C /tmp && cmake -S /tmp/ttyd-${TTYD_COMMIT} -B /tmp/ttyd-build && make -C /tmp/ttyd-build -j"$(nproc)" install && rm -rf /tmp/ttyd-${TTYD_COMMIT} /tmp/ttyd-build /var/lib/apt/lists/*`,
  `RUN curl -fsSL https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz | tar -xz -C /usr/local/bin caddy`,
  `RUN curl -fsSL https://code-server.dev/install.sh | sh -s -- --method=standalone --version=${CODE_SERVER_VERSION}`,
  "RUN curl -fsSL https://herdr.dev/install.sh | sh",
  // agent CLIs, preinstalled so herdr detects them out of the box. Modal
  // caches this layer on first build, freezing whatever versions npm
  // resolved then — bump the trailing comment to force a refresh.
  "RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y --no-install-recommends nodejs && rm -rf /var/lib/apt/lists/*",
  "RUN npm install -g @anthropic-ai/claude-code @openai/codex @earendil-works/pi-coding-agent # agents-v1",
  // uv: python packaging and standalone python builds, so a python project
  // needs no setup beyond `uv sync`. Pinned like everything else here.
  `RUN curl -fsSL https://astral.sh/uv/${UV_VERSION}/install.sh | sh`,
  // the installers drop binaries in /root/.local/bin, which login shells don't have on PATH
  "RUN ln -sf /root/.local/bin/herdr /root/.local/bin/code-server /root/.local/bin/uv /root/.local/bin/uvx /usr/local/bin/",
  // code-server defaults: dark theme, no telemetry, no trust prompts
  `RUN mkdir -p /root/.local/share/code-server/User && printf '%s' '{"workbench.colorTheme":"Default Dark Modern","security.workspace.trust.enabled":false,"telemetry.telemetryLevel":"off","workbench.startupEditor":"none"}' > /root/.local/share/code-server/User/settings.json`,
  // the working directory: an ordinary directory, captured by snapshots
  // like the rest of the machine
  `RUN mkdir -p ${WORKSPACE_DIR} && printf '%s' '${RUNTIME_VERSION}' > /etc/kitchen-runtime-version`,
  // zsh + oh-my-zsh as the default shell, with git + autosuggestions plugins.
  // ZSH_THEME stays empty: the kitchen prompt is set at boot (/etc/kitchen-zshrc).
  "RUN apt-get update && apt-get install -y --no-install-recommends zsh && rm -rf /var/lib/apt/lists/* && chsh -s /usr/bin/zsh root",
  'RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended',
  "RUN git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions /root/.oh-my-zsh/custom/plugins/zsh-autosuggestions",
  `RUN printf '%s\\n' 'export ZSH="$HOME/.oh-my-zsh"' 'ZSH_THEME="robbyrussell"' 'ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=241"' 'plugins=(git zsh-autosuggestions)' 'zstyle ":omz:alpha:lib:git" async-prompt no' 'source $ZSH/oh-my-zsh.sh' '[ -f /etc/kitchen-zshrc ] && source /etc/kitchen-zshrc' > /root/.zshrc`,
];

// NOTE: written to avoid \`${\` entirely — JS template interpolation would
// otherwise swallow the shell's own expansions.
export const bootScript = String.raw`
set -u
[ -n "$KITCHEN_SECRET" ] || { echo "KITCHEN_SECRET not set" >&2; exit 1; }
[ -n "$KITCHEN_SANDBOX_NAME" ] || KITCHEN_SANDBOX_NAME=sandbox
export PATH="/root/.local/bin:$PATH"
export SHELL=/usr/bin/zsh
# Unix sockets are fine on the sandbox's own filesystem now, but /tmp keeps
# the socket out of snapshots, where a stale socket file is meaningless.
export HERDR_SOCKET_PATH=/tmp/herdr.sock

mkdir -p /workspace
# name marker for the in-sandbox kitchen command
printf '%s' "$KITCHEN_SANDBOX_NAME" > /etc/kitchen-name

# herdr: replay recent pane contents after restarts. Seeded once only — the
# config lives in the machine now, so user edits stick.
mkdir -p /root/.config/herdr
if [ ! -f /root/.config/herdr/config.toml ]; then
	printf '[terminal]\ndefault_shell = "zsh"\n\n[experimental]\npane_history = true\n' > /root/.config/herdr/config.toml
fi

# --- prompt (root's .bashrc would otherwise override profile.d) ---
cat > /etc/profile.d/kitchen.sh <<PROFILE
export PS1='\[\e[38;5;191m\]kitchen@'$KITCHEN_SANDBOX_NAME'\[\e[0m\]:\[\e[38;5;110m\]\w\[\e[0m\]$ '
export PATH="/root/.local/bin:\$PATH"
export HERDR_SOCKET_PATH=/tmp/herdr.sock
case \$- in *i*)
	if [ -z "\$KITCHEN_MOTD_SHOWN" ]; then
		export KITCHEN_MOTD_SHOWN=1
		printf '\e[90mthe whole machine is saved when you stop $KITCHEN_SANDBOX_NAME - packages, config, /workspace, all of it.\ntype \e[0mkitchen\e[90m for details.\e[0m\n'
	fi
;; esac
PROFILE
echo '[ -f /etc/profile.d/kitchen.sh ] && . /etc/profile.d/kitchen.sh' >> /root/.bashrc

# --- the in-sandbox reference: how persistence actually works here ---
cat > /usr/local/bin/kitchen <<'KITCHENCMD'
#!/bin/sh
NAME=$(cat /etc/kitchen-name 2>/dev/null || echo sandbox)
printf '\033[1mkitchen\033[0m - sandbox \033[1m%s\033[0m\n\n' "$NAME"
printf 'this sandbox IS its filesystem. stopping it saves a snapshot of the whole\n'
printf 'machine; starting %s again restores it:\n\n' "$NAME"
printf '  /workspace                      your files\n'
printf '  apt / pip / npm -g installs     wherever they normally land\n'
printf '  uv / rustup / nvm, any toolchain no special setup needed\n'
printf '  agent logins, herdr sessions    claude / codex / pi, ~/.config\n'
printf '  vscode settings + extensions    dotfiles, /etc, shell history\n\n'
printf 'so install things normally - nothing needs to live in a special path.\n\n'
if [ -n "$KITCHEN_VOLUMES" ]; then
	printf 'mounted volumes (saved continuously, NOT part of snapshots):\n'
	printf '  %s\n\n' "$KITCHEN_VOLUMES"
fi
printf 'what is not saved:\n'
printf '  running processes - a restored sandbox boots its services fresh\n'
printf '  /etc/hosts, /etc/resolv.conf - the container rewrites these at boot\n'
printf '  work done after the last snapshot, if this sandbox is killed\n'
printf '  without being stopped (it has a 24h lifetime). stop it when you are\n'
printf '  done, or mount a volume for anything you cannot lose.\n\n'
printf 'browser tab:\n'
printf '  proxies to port 3000 in this sandbox - start any dev server there\n'
KITCHENCMD
chmod +x /usr/local/bin/kitchen

# --- zsh: env for every invocation, plus the kitchen prompt + MOTD ---
cat > /etc/zsh/zshenv <<ZSHENV
export PATH="/root/.local/bin:\$PATH"
export HERDR_SOCKET_PATH=/tmp/herdr.sock
export SHELL=/usr/bin/zsh
ZSHENV

cat > /etc/kitchen-zshrc <<KITCHENZSH
export HISTFILE=/root/.zsh_history
export HISTSIZE=10000
export SAVEHIST=10000
setopt share_history
if [ -z "\$KITCHEN_MOTD_SHOWN" ]; then
	export KITCHEN_MOTD_SHOWN=1
	printf '\e[90mthe whole machine is saved when you stop $KITCHEN_SANDBOX_NAME - packages, config, /workspace, all of it.\ntype \e[0mkitchen\e[90m for details.\e[0m\n'
fi
KITCHENZSH

# --- auth proxy: cookie exchange in front of every service ---
cat > /tmp/Caddyfile <<CADDYEOF
{
	admin off
	auto_https off
}
(kitchenauth) {
	@login {
		path /kitchen-auth
		query token=$KITCHEN_SECRET
	}
	handle @login {
		header Set-Cookie "kitchen=$KITCHEN_SECRET; Path=/; Secure; HttpOnly; SameSite=None"
		redir * / 302
	}
	@authed {
		header Cookie *kitchen=$KITCHEN_SECRET*
	}
	handle @authed {
		reverse_proxy 127.0.0.1:{args[0]}
	}
	handle {
		respond "kitchen: authentication required" 403
	}
}
:7681 {
	import kitchenauth 17681
}
:7683 {
	import kitchenauth 17683
}
:8443 {
	import kitchenauth 18443
}
:8080 {
	@login {
		path /kitchen-auth
		query token=$KITCHEN_SECRET
	}
	handle @login {
		header Set-Cookie "kitchen=$KITCHEN_SECRET; Path=/; Secure; HttpOnly; SameSite=None"
		redir * / 302
	}
	@authed {
		header Cookie *kitchen=$KITCHEN_SECRET*
	}
	handle @authed {
		reverse_proxy 127.0.0.1:3000 {
			header_up Host {upstream_hostport}
			header_down -X-Frame-Options
			header_down -Content-Security-Policy
		}
	}
	handle {
		respond "kitchen: authentication required" 403
	}
	handle_errors {
		respond "kitchen: nothing is listening on port 3000 in this sandbox yet. start your app on port 3000 and reload this tab." 502
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
echo "kitchen boot: a service exited" >&2
exit 1
`;
