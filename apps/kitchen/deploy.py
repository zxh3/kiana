# Deploys kitchen on Modal itself: the SvelteKit Node server runs as a Modal
# Server (@app.server), so the control plane lives next to the sandboxes it
# manages. The app stays stateless — users bring their own Modal token via
# the browser (localStorage), or set MODAL_TOKEN_ID / MODAL_TOKEN_SECRET /
# MODAL_ENVIRONMENT as a Modal Secret named "kitchen-deployment-credentials"
# for single-tenant deployment mode.
#
#   modal deploy apps/kitchen/deploy.py
#
# Custom domain (kitchen.dev): add it to this server in the Modal dashboard
# (Settings → Domains) and point DNS at Modal per the instructions there.

import subprocess

import modal

PORT = 3000

app = modal.App("kitchen")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "ca-certificates")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y --no-install-recommends nodejs",
    )
    .add_local_dir(
        ".",
        "/srv/kitchen",
        copy=True,
        ignore=["node_modules", ".svelte-kit", "build", ".env", "deploy.py"],
    )
    .workdir("/srv/kitchen")
    .run_commands("npm install", "npm run build")
)


@app.server(
    image=image,
    port=PORT,
    unauthenticated=True,
    routing_region="us-east",
    scaledown_window=300,
    startup_timeout=30,
)
class KitchenServer:
    @modal.enter()
    def start(self) -> None:
        self.process = subprocess.Popen(
            ["node", "build"],
            cwd="/srv/kitchen",
            env={"PORT": str(PORT), "HOST": "0.0.0.0", "PATH": "/usr/bin:/usr/local/bin:/bin"},
        )
