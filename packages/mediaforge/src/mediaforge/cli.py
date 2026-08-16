"""Command-line interface for Mediaforge."""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from pathlib import Path
from typing import ParamSpec, TypeVar

import click

from .apple_photos import DEFAULT_METADATA_NAME, export_album
from .pipeline import PipelineError, build_release, require_tools, verify_release

SOURCE = click.Path(path_type=Path, file_okay=False)
OUTPUT = click.Path(path_type=Path, file_okay=False)
METADATA = click.Path(path_type=Path, dir_okay=False)
P = ParamSpec("P")
R = TypeVar("R")


def handle_pipeline_errors(command: Callable[P, R]) -> Callable[P, R]:
    """Present pipeline failures as concise Click errors."""

    @wraps(command)
    def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return command(*args, **kwargs)
        except PipelineError as error:
            raise click.ClickException(str(error)) from error

    return wrapped


def resolved(path: Path) -> Path:
    return path.expanduser().resolve()


def resolved_metadata(source: Path, metadata: Path | None) -> Path:
    return resolved(metadata) if metadata else resolved(source) / DEFAULT_METADATA_NAME


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
def main() -> None:
    """Process photo and Live Photo releases locally."""


@main.group("apple-photos")
def apple_photos() -> None:
    """Import albums from Apple Photos using osxphotos."""


@apple_photos.command("export")
@click.argument("output", type=OUTPUT)
@click.option("--album", required=True, help="Apple Photos album name.")
@click.option("--metadata", type=METADATA, help="Metadata output path.")
@click.option(
    "--library",
    type=click.Path(path_type=Path, exists=True),
    help="Photos library path; defaults to the last opened library.",
)
@handle_pipeline_errors
def apple_photos_export(
    output: Path,
    album: str,
    metadata: Path | None,
    library: Path | None,
) -> None:
    """Incrementally export an album and generate Mediaforge metadata."""

    metadata_path, count = export_album(
        album,
        resolved(output),
        metadata_path=metadata,
        library=library,
    )
    click.echo(f"Exported metadata for {count} assets to {metadata_path}")


@main.command()
@click.argument("source", type=SOURCE)
@click.option("--metadata", type=METADATA, help="Metadata JSON; defaults inside SOURCE.")
@handle_pipeline_errors
def doctor(source: Path, metadata: Path | None) -> None:
    """Check local tools and input paths."""

    source = resolved(source)
    metadata = resolved_metadata(source, metadata)
    require_tools()
    if not source.is_dir():
        raise PipelineError(f"Source directory not found: {source}")
    if not metadata.is_file():
        raise PipelineError(f"Metadata file not found: {metadata}")
    click.echo(f"Ready: {source}")


@main.command()
@click.argument("source", type=SOURCE)
@click.argument("output", type=OUTPUT)
@click.option("--metadata", type=METADATA, help="Metadata JSON; defaults inside SOURCE.")
@click.option("--limit", type=click.IntRange(min=1), default=20, show_default=True)
@handle_pipeline_errors
def sample(source: Path, output: Path, metadata: Path | None, limit: int) -> None:
    """Build a representative sample."""

    process_assets(source, output, metadata, limit=limit)


@main.command()
@click.argument("source", type=SOURCE)
@click.argument("output", type=OUTPUT)
@click.option("--metadata", type=METADATA, help="Metadata JSON; defaults inside SOURCE.")
@handle_pipeline_errors
def process(source: Path, output: Path, metadata: Path | None) -> None:
    """Build or resume a full web release."""

    process_assets(source, output, metadata)


def process_assets(
    source: Path,
    output: Path,
    metadata: Path | None,
    *,
    limit: int | None = None,
) -> None:
    output = resolved(output)
    count, failures = build_release(
        resolved(source),
        output,
        resolved_metadata(source, metadata),
        limit=limit,
    )
    click.echo(f"Processed {count} assets into {output}")
    if failures:
        click.echo(f"Failed assets: {len(failures)} (see errors.json)", err=True)
        raise click.exceptions.Exit(1)


@main.command()
@click.argument("source", type=SOURCE)
@click.argument("output", type=OUTPUT)
@click.option("--metadata", type=METADATA, help="Metadata JSON; defaults inside SOURCE.")
@click.option("--deep", is_flag=True, help="Probe every video codec (slower).")
@handle_pipeline_errors
def verify(source: Path, output: Path, metadata: Path | None, deep: bool) -> None:
    """Verify a completed release."""

    output = resolved(output)
    errors = verify_release(
        resolved(source),
        output,
        resolved_metadata(source, metadata),
        deep=deep,
    )
    if errors:
        for error in errors:
            click.echo(f"ERROR: {error}", err=True)
        raise click.exceptions.Exit(1)
    click.echo(f"Verified: {output}")


if __name__ == "__main__":
    main()
