"""Apple Photos import adapter powered by osxphotos."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from .pipeline import PipelineError, write_json_atomic

DEFAULT_METADATA_NAME = "mediaforge-metadata.json"
EXPORT_REPORT_NAME = "mediaforge-export-report.json"
METADATA_FIELDS = (
    "uuid",
    "date_original",
    "original_filename",
    "live_photo",
    "ismovie",
    "favorite",
    "title",
    "description",
    "keywords",
    "persons",
    "labels",
    "location",
    "latitude",
    "longitude",
    "width",
    "height",
)


def require_osxphotos() -> str:
    if sys.platform != "darwin":
        raise PipelineError("Apple Photos export is only available on macOS")
    executable = shutil.which("osxphotos")
    if not executable:
        raise PipelineError("osxphotos is not installed; run `uv sync --package mediaforge`")
    return executable


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        command,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    if result.returncode:
        detail = result.stderr.strip() if result.stderr else f"exit code {result.returncode}"
        raise PipelineError(f"osxphotos failed: {detail}")
    return result.stdout if capture and result.stdout else ""


def library_args(library: Path | None) -> list[str]:
    return ["--library", str(library.expanduser().resolve())] if library else []


def parse_metadata(raw: str) -> list[dict[str, Any]]:
    try:
        metadata = json.loads(raw)
    except json.JSONDecodeError as error:
        raise PipelineError("osxphotos returned invalid metadata JSON") from error
    if not isinstance(metadata, list) or any(
        not isinstance(item, dict) or not isinstance(item.get("uuid"), str) for item in metadata
    ):
        raise PipelineError("osxphotos metadata did not contain a list of photos with UUIDs")
    return [{field: item[field] for field in METADATA_FIELDS if field in item} for item in metadata]


def export_album(
    album: str,
    output: Path,
    *,
    metadata_path: Path | None = None,
    library: Path | None = None,
) -> tuple[Path, int]:
    """Incrementally export an Apple Photos album and its metadata."""

    executable = require_osxphotos()
    output = output.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    metadata_path = (
        metadata_path.expanduser().resolve() if metadata_path else output / DEFAULT_METADATA_NAME
    )
    shared = [*library_args(library), "--album", album]

    run(
        [
            executable,
            "export",
            str(output),
            *shared,
            "--download-missing",
            "--use-photokit",
            "--filename",
            "{uuid}",
            "--update",
            "--retry",
            "3",
            "--report",
            str(output / EXPORT_REPORT_NAME),
        ]
    )
    metadata = parse_metadata(run([executable, "query", *shared, "--json"], capture=True))
    write_json_atomic(metadata_path, metadata)
    return metadata_path, len(metadata)
