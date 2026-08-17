from __future__ import annotations

from pathlib import Path

import pytest
from click.testing import CliRunner
from mediaforge import cli
from mediaforge.cli import main


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


def test_help_lists_commands(runner: CliRunner) -> None:
    result = runner.invoke(main, ["--help"])

    assert result.exit_code == 0
    for command in ("doctor", "sample", "process", "verify"):
        assert command in result.output


def test_doctor_reports_missing_metadata(
    runner: CliRunner,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("mediaforge.cli.require_tools", lambda: None)
    missing = tmp_path / "missing.json"

    result = runner.invoke(
        main,
        ["doctor", str(tmp_path), "--metadata", str(missing)],
    )

    assert result.exit_code == 1
    assert "Metadata file not found" in result.output


@pytest.mark.parametrize(
    ("command", "extra_arguments", "expected_limit"),
    [
        ("process", [], None),
        ("sample", ["--limit", "3"], 3),
    ],
)
def test_processing_commands_forward_job_count_and_report_verification(
    runner: CliRunner,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    command: str,
    extra_arguments: list[str],
    expected_limit: int | None,
) -> None:
    received: dict[str, object] = {}

    def fake_build_release(
        source: Path,
        output: Path,
        metadata: Path,
        *,
        limit: int | None = None,
        jobs: int,
        force_images: bool,
    ) -> tuple[int, list[dict[str, str]]]:
        received.update(
            source=source,
            output=output,
            metadata=metadata,
            limit=limit,
            jobs=jobs,
            force_images=force_images,
        )
        return 2, []

    monkeypatch.setattr(cli, "build_release", fake_build_release)
    source = tmp_path / "source"
    source.mkdir()
    output = tmp_path / "output"

    result = runner.invoke(
        main,
        [command, str(source), str(output), "--jobs", "2", *extra_arguments],
    )

    assert result.exit_code == 0
    assert received["jobs"] == 2
    assert received["limit"] == expected_limit
    assert received["force_images"] is False
    assert f"Verified: {output}" in result.output


def test_process_forwards_force_images(
    runner: CliRunner, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: dict[str, object] = {}

    def fake_build_release(
        source: Path,
        output: Path,
        metadata: Path,
        *,
        limit: int | None = None,
        jobs: int,
        force_images: bool,
    ) -> tuple[int, list[dict[str, str]]]:
        received["force_images"] = force_images
        return 1, []

    monkeypatch.setattr(cli, "build_release", fake_build_release)
    source = tmp_path / "source"
    source.mkdir()

    result = runner.invoke(
        main, ["process", str(source), str(tmp_path / "output"), "--force-images"]
    )

    assert result.exit_code == 0
    assert received["force_images"] is True
