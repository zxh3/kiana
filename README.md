# Kiana

Kiana is a small monorepo containing:

- `apps/kiana`: a TanStack Start app styled with Tailwind CSS.
- `packages/mediaforge`: a Python CLI for preparing photos and videos for the web.

## Setup

Install the JavaScript and Python dependencies from the repository root:

```bash
npm install
uv sync --all-packages
```

## Development

Start the web app at <http://localhost:3000>:

```bash
npm run dev
```

Before committing, run the repository checks:

```bash
npm run build
uv run ruff format --check .
uv run ruff check .
uv run ty check packages
uv run pytest
```

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for
commit messages. See [`packages/mediaforge/README.md`](packages/mediaforge/README.md)
for the photo-processing and release workflow.
