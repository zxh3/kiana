from __future__ import annotations

import base64
import json
import subprocess
import threading
from pathlib import Path

import pytest
from mediaforge import pipeline
from mediaforge.pipeline import Asset, load_assets, select_sample, write_json_atomic

ORIENTED_JPEG = (
    "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAgESAAMAAAABAAYAAIdpAAQAAAAB"
    "AAAAJgAAAAAAAqACAAQAAAABAAAAAqADAAQAAAABAAAAAwAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklN"
    "BAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAwACAwEiAAIRAQMRAf/EAB8A"
    "AAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFB"
    "BhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldY"
    "WVp jZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfI"
    "ycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYH"
    "CAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy"
    "0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWG"
    "h4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz"
    "9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwM"
    "DA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB"
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+qPAItbLwL4cs4bGz"
    "aODTbONTJaQSuQsKgFndGdm9WYkk8kk11v2iH/oH2H/AIAWv/xquR8Gf8ifoX/Xha/+ilrpa/tD/iHuQ"
    "f8AQvo/+Cof/Inz/wBaq/zv7z//2Q=="
).replace(" ", "")


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


def test_image_normalizer_applies_embedded_orientation(tmp_path: Path) -> None:
    source = tmp_path / "oriented.jpg"
    destination = tmp_path / "normalized.png"
    source.write_bytes(base64.b64decode(ORIENTED_JPEG))

    subprocess.run(
        [str(pipeline.image_normalizer()), str(source), str(destination), "100"],
        check=True,
    )

    stream = next(item for item in pipeline.probe(destination)["streams"] if item.get("width"))
    assert (stream["width"], stream["height"]) == (3, 2)


def test_webp_falls_back_to_ffmpeg_when_imageio_rejects_jpeg(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = tmp_path / "unusual.jpg"
    destination = tmp_path / "output.webp"
    source.write_bytes(b"jpeg")
    commands: list[list[str]] = []

    monkeypatch.setattr(pipeline, "image_normalizer", lambda: Path("image-normalizer"))

    def fake_run(command: list[str]) -> None:
        commands.append(command)
        if command[0] == "image-normalizer":
            raise subprocess.CalledProcessError(66, command)
        Path(command[-1]).write_bytes(b"image")

    monkeypatch.setattr(pipeline, "run", fake_run)

    pipeline.make_webp(source, destination, 1280)

    assert destination.read_bytes() == b"image"
    assert [command[0] for command in commands] == ["image-normalizer", "ffmpeg", "cwebp"]


def test_stream_rotation_reads_display_matrix() -> None:
    assert pipeline.stream_rotation({"side_data_list": [{"rotation": -90}]}) == 270
    assert pipeline.stream_rotation({"tags": {"rotate": "180"}}) == 180
    assert pipeline.stream_rotation({}) == 0


def test_verify_rejects_live_photo_orientation_mismatch(tmp_path: Path) -> None:
    uuid = "00000000-0000-4000-8000-000000000001"
    paths = [
        tmp_path / "images" / f"{uuid}-1280.webp",
        tmp_path / "images" / f"{uuid}-2400.webp",
        tmp_path / "videos" / f"{uuid}.mp4",
    ]
    for path in paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"media")
    manifest = {
        "assets": [
            {
                "id": uuid,
                "type": "live_photo",
                "image": {
                    "small": f"images/{uuid}-1280.webp",
                    "large": f"images/{uuid}-2400.webp",
                    "width": 2400,
                    "height": 1800,
                },
                "video": {
                    "src": f"videos/{uuid}.mp4",
                    "width": 1308,
                    "height": 1744,
                    "durationMs": 3000,
                },
            }
        ]
    }

    errors = pipeline.verify_manifest(tmp_path, manifest, expected={uuid})

    assert errors == [f"Live Photo orientation differs: {uuid}"]


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

    def fake_process_asset(
        asset: Asset,
        output: Path,
        *,
        force_images: bool,
    ) -> dict[str, object]:
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

    def fake_process_asset(
        asset: Asset,
        output: Path,
        *,
        force_images: bool,
    ) -> dict[str, object]:
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
    monkeypatch.setattr(
        pipeline,
        "process_asset",
        lambda asset, output, *, force_images: make_record(asset),
    )
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
