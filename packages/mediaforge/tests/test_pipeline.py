from __future__ import annotations

import json
import threading
from pathlib import Path

import pytest
from mediaforge import pipeline
from mediaforge.pipeline import Asset, load_assets, select_sample, write_json_atomic


def make_asset(number: int) -> Asset:
    uuid = f"00000000-0000-4000-8000-{number:012d}"
    return Asset(uuid, (Path(f"{uuid}.HEIC"),), {})


def make_record(asset: Asset) -> dict[str, object]:
    return {
        "id": asset.uuid,
        "type": asset.kind,
        "date": None,
        "image": {
            "small": f"images/{asset.uuid}-1280.webp",
            "large": f"images/{asset.uuid}-2400.webp",
            "width": 2400,
            "height": 1600,
        },
    }


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


@pytest.mark.parametrize("processor", ["webp", "poster", "mp4"])
def test_processors_leave_existing_outputs_unchanged(
    processor: str,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    destination = tmp_path / f"existing.{('mp4' if processor == 'mp4' else 'webp')}"
    destination.write_bytes(b"existing output")

    def unexpected(*args: object, **kwargs: object) -> None:
        raise AssertionError("existing output should not be processed")

    monkeypatch.setattr(pipeline, "run", unexpected)
    monkeypatch.setattr(pipeline, "probe", unexpected)

    if processor == "webp":
        pipeline.make_webp(tmp_path / "source.heic", destination, 1280)
    elif processor == "poster":
        pipeline.make_poster(tmp_path / "source.mov", destination, 1280)
    else:
        pipeline.make_mp4(tmp_path / "source.mov", destination)

    assert destination.read_bytes() == b"existing output"


def test_build_release_processes_assets_concurrently_and_preserves_order(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assets = [make_asset(1), make_asset(2)]
    second_started = threading.Event()
    verification: dict[str, object] = {}

    def fake_process_asset(asset: Asset, output: Path) -> dict[str, object]:
        if asset == assets[0]:
            assert second_started.wait(timeout=2), "assets did not overlap"
        else:
            second_started.set()
        return make_record(asset)

    def fake_verify_manifest(
        output: Path,
        manifest: dict[str, object],
        *,
        expected: set[str],
        deep: bool = False,
    ) -> list[str]:
        verification.update(manifest=manifest, expected=expected, deep=deep)
        return []

    monkeypatch.setattr(pipeline, "require_tools", lambda: None)
    monkeypatch.setattr(pipeline, "load_assets", lambda source, metadata: assets)
    monkeypatch.setattr(pipeline, "process_asset", fake_process_asset)
    monkeypatch.setattr(pipeline, "verify_manifest", fake_verify_manifest)

    count, failures = pipeline.build_release(
        tmp_path / "source",
        tmp_path / "output",
        tmp_path / "metadata.json",
        jobs=2,
    )

    manifest = json.loads((tmp_path / "output" / "manifest.json").read_text())
    assert count == 2
    assert failures == []
    assert [record["id"] for record in manifest["assets"]] == [asset.uuid for asset in assets]
    assert verification["expected"] == {asset.uuid for asset in assets}
    assert verification["deep"] is True
    assert not (tmp_path / "output" / "manifest.partial.json").exists()


def test_build_release_keeps_ordered_partial_results_after_failures(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assets = [make_asset(1), make_asset(2), make_asset(3)]
    output = tmp_path / "output"
    output.mkdir()
    (output / "manifest.json").write_text("old manifest")

    def fake_process_asset(asset: Asset, output: Path) -> dict[str, object]:
        if asset.uuid in {assets[0].uuid, assets[2].uuid}:
            raise pipeline.PipelineError(f"failed {asset.uuid}")
        return make_record(asset)

    monkeypatch.setattr(pipeline, "require_tools", lambda: None)
    monkeypatch.setattr(pipeline, "load_assets", lambda source, metadata: assets)
    monkeypatch.setattr(pipeline, "process_asset", fake_process_asset)

    count, failures = pipeline.build_release(
        tmp_path / "source",
        output,
        tmp_path / "metadata.json",
        jobs=3,
    )

    partial = json.loads((output / "manifest.partial.json").read_text())
    errors = json.loads((output / "errors.json").read_text())
    assert count == 1
    assert [failure["id"] for failure in failures] == [assets[0].uuid, assets[2].uuid]
    assert [record["id"] for record in partial["assets"]] == [assets[1].uuid]
    assert errors == failures
    assert not (output / "manifest.json").exists()


def test_build_release_only_publishes_manifest_after_verification(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    asset = make_asset(1)
    output = tmp_path / "output"

    monkeypatch.setattr(pipeline, "require_tools", lambda: None)
    monkeypatch.setattr(pipeline, "load_assets", lambda source, metadata: [asset])
    monkeypatch.setattr(pipeline, "process_asset", lambda asset, output: make_record(asset))
    monkeypatch.setattr(
        pipeline,
        "verify_manifest",
        lambda output, manifest, *, expected, deep: ["verification failed"],
    )

    count, failures = pipeline.build_release(
        tmp_path / "source",
        output,
        tmp_path / "metadata.json",
        jobs=1,
    )

    assert count == 1
    assert failures == [{"id": "verification", "error": "verification failed"}]
    assert (output / "manifest.partial.json").is_file()
    assert not (output / "manifest.json").exists()
    assert json.loads((output / "errors.json").read_text()) == failures
