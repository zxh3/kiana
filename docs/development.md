# Kiana

Kiana is a small monorepo containing:

- `apps/kiana`: a TanStack Start app styled with Tailwind CSS.
- `apps/kiana-desktop`: a native macOS menu-bar app that displays the web app
  as a live desktop wallpaper.
- `apps/infra`: a Python/Pulumi app that manages the AWS infrastructure.
- `packages/mediaforge`: a Python CLI for preparing photos and videos for the web.

## Setup

Install the JavaScript and Python dependencies from the repository root:

```bash
npm install
uv sync --all-packages
```

The Python workspace uses one environment and lockfile at the repository root.
To install only the infrastructure app's dependencies, run
`uv sync --package infra`. See [`apps/infra/README.md`](../apps/infra/README.md)
for Pulumi commands and prerequisites.

## Development

Start the web app at <http://localhost:3000>:

```bash
npm run dev
```

The app reads its default processed release from `media.kiana.me`. To test a
different Cloudflare R2 release, copy `apps/kiana/.env.example` to
`apps/kiana/.env.local` and override its URL. See
[`apps/kiana/README.md`](../apps/kiana/README.md).

Before committing, run the repository checks:

```bash
npm run build
uv run ruff format --check .
uv run ruff check .
uv run ty check packages apps/infra
uv run pytest
```

The macOS app is an independent Xcode project because it uses AppKit and WebKit
rather than the JavaScript workspace. Open
`apps/kiana-desktop/KianaDesktop.xcodeproj` in Xcode to build and run it. See
[`apps/kiana-desktop/README.md`](../apps/kiana-desktop/README.md) for behavior,
requirements, and the command-line build command.

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for
commit messages. See
[`packages/mediaforge/README.md`](../packages/mediaforge/README.md) for the
photo-processing and release workflow.
