"""Media discovery, transcoding, manifest generation, and verification."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

UUID_RE = re.compile(r"^([0-9A-Fa-f-]{36})(_edited)?\.(heic|jpe?g|png|mov|mp4)$", re.I)
IMAGE_EXTENSIONS = {".heic", ".jpg", ".jpeg", ".png"}
VIDEO_EXTENSIONS = {".mov", ".mp4"}
REQUIRED_TOOLS = ("cwebp", "ffmpeg", "ffprobe", "sips")


class PipelineError(RuntimeError):
    """A user-facing pipeline error."""


@dataclass(frozen=True)
class Asset:
    uuid: str
    files: tuple[Path, ...]
    metadata: dict[str, Any]

    def preferred(self, extensions: set[str]) -> Path | None:
        choices = [file for file in self.files if file.suffix.lower() in extensions]
        return next((file for file in choices if "_edited" in file.stem.lower()), None) or (
            choices[0] if choices else None
        )

    @property
    def image(self) -> Path | None:
        return self.preferred(IMAGE_EXTENSIONS)

    @property
    def video(self) -> Path | None:
        return self.preferred(VIDEO_EXTENSIONS)

    @property
    def kind(self) -> str:
        if self.metadata.get("live_photo") and self.image and self.video:
            return "live_photo"
        if self.metadata.get("ismovie") or (self.video and not self.image):
            return "video"
        return "photo"


def require_tools() -> None:
    missing = [tool for tool in REQUIRED_TOOLS if not shutil.which(tool)]
    if missing:
        raise PipelineError(f"Missing required tools: {', '.join(missing)}")


def run(command: list[str]) -> None:
    result = subprocess.run(command, text=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if result.returncode:
        detail = result.stderr.strip() or f"exit code {result.returncode}"
        raise subprocess.CalledProcessError(result.returncode, command, stderr=detail)


def probe(path: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=index,codec_name,codec_type,width,height,pix_fmt:format=duration",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def atomic_destination(destination: Path) -> tuple[Path, Callable[[], None]]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.stem}-",
        suffix=destination.suffix,
        dir=destination.parent,
    )
    os.close(descriptor)
    temporary = Path(temporary_name)

    def commit() -> None:
        if not temporary.exists() or not temporary.stat().st_size:
            raise PipelineError(f"Processor produced an empty file: {destination}")
        os.replace(temporary, destination)

    return temporary, commit


def existing(destination: Path) -> bool:
    return destination.is_file() and destination.stat().st_size > 0


def make_webp(source: Path, destination: Path, max_edge: int) -> None:
    if existing(destination):
        return
    temporary, commit = atomic_destination(destination)
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            intermediate = Path(temp_dir) / "image.png"
            try:
                run(
                    [
                        "sips",
                        "-s",
                        "format",
                        "png",
                        "-Z",
                        str(max_edge),
                        str(source),
                        "--out",
                        str(intermediate),
                    ]
                )
            except subprocess.CalledProcessError:
                if source.suffix.lower() == ".heic":
                    raise
                run(
                    [
                        "ffmpeg",
                        "-y",
                        "-loglevel",
                        "error",
                        "-i",
                        str(source),
                        "-frames:v",
                        "1",
                        "-vf",
                        f"scale={max_edge}:{max_edge}:force_original_aspect_ratio=decrease:force_divisible_by=2",
                        "-map_metadata",
                        "-1",
                        str(intermediate),
                    ]
                )
            run(
                [
                    "cwebp",
                    "-quiet",
                    "-q",
                    "84",
                    "-metadata",
                    "none",
                    str(intermediate),
                    "-o",
                    str(temporary),
                ]
            )
        commit()
    finally:
        temporary.unlink(missing_ok=True)


def make_poster(source: Path, destination: Path, max_edge: int) -> None:
    if existing(destination):
        return
    duration = float(probe(source).get("format", {}).get("duration", 0))
    seek = 0.5 if duration >= 1 else 0
    temporary, commit = atomic_destination(destination)
    try:
        run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-ss",
                str(seek),
                "-i",
                str(source),
                "-frames:v",
                "1",
                "-vf",
                f"scale={max_edge}:{max_edge}:force_original_aspect_ratio=decrease:force_divisible_by=2",
                "-c:v",
                "libwebp",
                "-quality",
                "84",
                "-map_metadata",
                "-1",
                str(temporary),
            ]
        )
        commit()
    finally:
        temporary.unlink(missing_ok=True)


def make_mp4(source: Path, destination: Path) -> None:
    if existing(destination):
        return
    info = probe(source)
    video = next(
        (stream for stream in info["streams"] if stream.get("codec_type") == "video"), None
    )
    if not video:
        raise PipelineError(f"No video stream found: {source}")
    audio = next(
        (
            stream
            for stream in info["streams"]
            if stream.get("codec_type") == "audio"
            and stream.get("codec_name") in {"aac", "mp3", "alac"}
        ),
        None,
    )
    maps = ["-map", f"0:{video['index']}"] + (["-map", f"0:{audio['index']}"] if audio else [])
    temporary, commit = atomic_destination(destination)
    try:
        if video.get("codec_name") == "h264" and (
            audio is None or audio.get("codec_name") == "aac"
        ):
            run(
                [
                    "ffmpeg",
                    "-y",
                    "-loglevel",
                    "error",
                    "-i",
                    str(source),
                    *maps,
                    "-c",
                    "copy",
                    "-movflags",
                    "+faststart",
                    "-map_metadata",
                    "-1",
                    str(temporary),
                ]
            )
        else:
            run(
                [
                    "ffmpeg",
                    "-y",
                    "-loglevel",
                    "error",
                    "-i",
                    str(source),
                    *maps,
                    "-c:v",
                    "libx264",
                    "-preset",
                    "medium",
                    "-crf",
                    "21",
                    "-pix_fmt",
                    "yuv420p",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "128k",
                    "-movflags",
                    "+faststart",
                    "-map_metadata",
                    "-1",
                    str(temporary),
                ]
            )
        commit()
    finally:
        temporary.unlink(missing_ok=True)


def load_assets(source: Path, metadata_path: Path) -> list[Asset]:
    if not source.is_dir():
        raise PipelineError(f"Source directory not found: {source}")
    if not metadata_path.is_file():
        raise PipelineError(f"Metadata file not found: {metadata_path}")
    metadata = {item["uuid"].upper(): item for item in json.loads(metadata_path.read_text())}
    grouped: dict[str, list[Path]] = {}
    for file in source.iterdir():
        match = UUID_RE.match(file.name)
        if match:
            grouped.setdefault(match.group(1).upper(), []).append(file)
    return [
        Asset(uuid, tuple(sorted(files)), metadata.get(uuid, {}))
        for uuid, files in sorted(grouped.items())
    ]


def select_sample(assets: list[Asset], limit: int) -> list[Asset]:
    if len(assets) <= limit:
        return assets
    buckets = {
        kind: [asset for asset in assets if asset.kind == kind]
        for kind in ("photo", "video", "live_photo")
    }
    targets = {
        "photo": max(1, limit // 2),
        "video": max(1, limit // 4),
        "live_photo": max(1, limit // 4),
    }
    selected = [asset for kind, count in targets.items() for asset in buckets[kind][:count]]
    selected_ids = {asset.uuid for asset in selected}
    selected.extend(
        asset for asset in assets if asset.uuid not in selected_ids and len(selected) < limit
    )
    return selected[:limit]


def process_asset(asset: Asset, output: Path) -> dict[str, Any]:
    small = output / "images" / f"{asset.uuid}-1280.webp"
    large = output / "images" / f"{asset.uuid}-2400.webp"
    if asset.image:
        make_webp(asset.image, small, 1280)
        make_webp(asset.image, large, 2400)
    elif asset.video:
        make_poster(asset.video, small, 1280)
        make_poster(asset.video, large, 2400)
    else:
        raise PipelineError(f"No usable media for {asset.uuid}")
    image_stream = next(stream for stream in probe(large)["streams"] if stream.get("width"))
    record: dict[str, Any] = {
        "id": asset.uuid,
        "type": asset.kind,
        "date": asset.metadata.get("date_original"),
        "image": {
            "small": f"images/{small.name}",
            "large": f"images/{large.name}",
            "width": int(image_stream["width"]),
            "height": int(image_stream["height"]),
        },
    }
    if asset.video:
        video_output = output / "videos" / f"{asset.uuid}.mp4"
        make_mp4(asset.video, video_output)
        video_info = probe(video_output)
        stream = next(
            stream for stream in video_info["streams"] if stream.get("codec_type") == "video"
        )
        record["video"] = {
            "src": f"videos/{video_output.name}",
            "width": int(stream["width"]),
            "height": int(stream["height"]),
            "durationMs": round(float(video_info["format"].get("duration", 0)) * 1000),
        }
    return record


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary, commit = atomic_destination(path)
    try:
        temporary.write_text(json.dumps(value, indent=2) + "\n")
        commit()
    finally:
        temporary.unlink(missing_ok=True)


def build_release(
    source: Path, output: Path, metadata: Path, *, limit: int | None = None
) -> tuple[int, list[dict[str, str]]]:
    require_tools()
    assets = load_assets(source, metadata)
    if limit is not None:
        assets = select_sample(assets, limit)
    records: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    for index, asset in enumerate(assets, 1):
        print(f"[{index}/{len(assets)}] {asset.kind}: {asset.uuid}", flush=True)
        try:
            records.append(process_asset(asset, output))
        except Exception as error:  # Continue so one unusual asset cannot waste a long run.
            message = (
                error.stderr
                if isinstance(error, subprocess.CalledProcessError) and error.stderr
                else str(error)
            )
            failures.append({"id": asset.uuid, "error": message})
            print(f"ERROR {asset.uuid}: {message}", flush=True)
    manifest = {
        "schemaVersion": 1,
        "revision": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": source.as_posix(),
        "assets": records,
    }
    manifest_name = "manifest.partial.json" if failures else "manifest.json"
    write_json_atomic(output / manifest_name, manifest)
    if failures:
        write_json_atomic(output / "errors.json", failures)
    else:
        (output / "manifest.partial.json").unlink(missing_ok=True)
        (output / "errors.json").unlink(missing_ok=True)
    return len(records), failures


def verify_release(source: Path, output: Path, metadata: Path, *, deep: bool = False) -> list[str]:
    errors: list[str] = []
    manifest_path = output / "manifest.json"
    if not manifest_path.is_file():
        return [f"Missing manifest: {manifest_path}"]
    manifest = json.loads(manifest_path.read_text())
    expected = {asset.uuid for asset in load_assets(source, metadata)}
    records = manifest.get("assets", [])
    actual = {record.get("id") for record in records}
    if expected != actual:
        missing = len(expected - actual)
        unexpected = len(actual - expected)
        errors.append(f"Manifest IDs differ: {missing} missing, {unexpected} unexpected")
    for record in records:
        paths = [output / record["image"]["small"], output / record["image"]["large"]]
        if record.get("video"):
            paths.append(output / record["video"]["src"])
        for path in paths:
            if not existing(path):
                errors.append(f"Missing or empty: {path}")
        if max(record["image"]["width"], record["image"]["height"]) > 2400:
            errors.append(f"Image exceeds 2400px: {record['id']}")
        if deep and all(existing(path) for path in paths):
            try:
                if record.get("video"):
                    stream = next(
                        stream
                        for stream in probe(output / record["video"]["src"])["streams"]
                        if stream.get("codec_type") == "video"
                    )
                    if stream.get("codec_name") != "h264":
                        errors.append(f"Video is not H.264: {record['id']}")
            except Exception as error:
                errors.append(f"Cannot decode {record['id']}: {error}")
    return errors
