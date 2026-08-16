from __future__ import annotations

import json
from pathlib import Path

import pytest
from mediaforge import pipeline
from mediaforge.pipeline import Asset, load_assets, select_sample, write_json_atomic


def test_load_assets_prefers_edited_and_pairs_live_photo(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    uuid = "00000000-0000-4000-8000-000000000001"
    for name in (f"{uuid}.HEIC", f"{uuid}_edited.jpeg", f"{uuid}.mov"):
        (source / name).touch()
    metadata = tmp_path / "metadata.json"
    metadata.write_text(json.dumps([{"uuid": uuid, "live_photo": True, "ismovie": False}]))

    assets = load_assets(source, metadata)

    assert len(assets) == 1
    image = assets[0].image
    video = assets[0].video
    assert image is not None
    assert video is not None
    assert image.name == f"{uuid}_edited.jpeg"
    assert video.name == f"{uuid}.mov"
    assert assets[0].kind == "live_photo"


def test_sample_contains_each_media_type() -> None:
    def asset(number: int, kind: str) -> Asset:
        uuid = f"00000000-0000-4000-8000-{number:012d}"
        if kind == "photo":
            files = (Path(f"{uuid}.HEIC"),)
            metadata = {}
        elif kind == "video":
            files = (Path(f"{uuid}.MOV"),)
            metadata = {"ismovie": True}
        else:
            files = (Path(f"{uuid}.HEIC"), Path(f"{uuid}.MOV"))
            metadata = {"live_photo": True}
        return Asset(uuid, files, metadata)

    assets = [
        asset(i, kind)
        for i, kind in enumerate(((["photo"] * 10) + (["video"] * 5) + (["live_photo"] * 5)), 1)
    ]

    sample = select_sample(assets, 8)

    assert {item.kind for item in sample} == {"photo", "video", "live_photo"}


def test_atomic_json_write(tmp_path: Path) -> None:
    destination = tmp_path / "manifest.json"

    write_json_atomic(destination, {"schemaVersion": 1})

    assert json.loads(destination.read_text()) == {"schemaVersion": 1}
    assert not any(path.name.startswith(".manifest-") for path in destination.parent.iterdir())


def test_short_video_poster_uses_first_frame(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    commands: list[list[str]] = []

    monkeypatch.setattr(
        pipeline,
        "probe",
        lambda path: {"format": {"duration": "0.098"}},
    )

    def fake_run(command: list[str]) -> None:
        commands.append(command)
        Path(command[-1]).write_bytes(b"webp")

    monkeypatch.setattr(pipeline, "run", fake_run)
    destination = tmp_path / "poster.webp"

    pipeline.make_poster(tmp_path / "short.mov", destination, 1280)

    assert destination.read_bytes() == b"webp"
    assert commands[0][commands[0].index("-ss") + 1] == "0"
