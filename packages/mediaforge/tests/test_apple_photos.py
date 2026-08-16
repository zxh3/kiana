from __future__ import annotations

import json
from pathlib import Path

import pytest
from mediaforge import apple_photos
from mediaforge.pipeline import PipelineError


def test_parse_metadata_requires_photo_uuids() -> None:
    assert apple_photos.parse_metadata('[{"uuid": "ABC"}]') == [{"uuid": "ABC"}]
    assert apple_photos.parse_metadata('[{"uuid": "ABC", "path": "/private/photo.jpg"}]') == [
        {"uuid": "ABC"}
    ]

    with pytest.raises(PipelineError, match="list of photos with UUIDs"):
        apple_photos.parse_metadata('[{"filename": "cat.jpg"}]')


def test_export_album_runs_incremental_export_and_writes_metadata(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    commands: list[list[str]] = []

    def fake_run(command: list[str], *, capture: bool = False) -> str:
        commands.append(command)
        return '[{"uuid": "ABC", "live_photo": true}]' if capture else ""

    monkeypatch.setattr(apple_photos, "require_osxphotos", lambda: "/bin/osxphotos")
    monkeypatch.setattr(apple_photos, "run", fake_run)

    metadata_path, count = apple_photos.export_album("Kiana", tmp_path)

    assert count == 1
    assert metadata_path == tmp_path / apple_photos.DEFAULT_METADATA_NAME
    assert json.loads(metadata_path.read_text())[0]["uuid"] == "ABC"
    assert commands[0][:3] == ["/bin/osxphotos", "export", str(tmp_path)]
    assert "--update" in commands[0]
    assert commands[1] == ["/bin/osxphotos", "query", "--album", "Kiana", "--json"]
