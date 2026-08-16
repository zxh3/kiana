from __future__ import annotations

from pathlib import Path

import pytest
from click.testing import CliRunner
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
