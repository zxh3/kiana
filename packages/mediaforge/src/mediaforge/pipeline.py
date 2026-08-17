"""Media discovery, transcoding, manifest generation, and verification."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from importlib.resources import as_file, files
from pathlib import Path
from typing import Any

UUID_RE = re.compile(r"^([0-9A-Fa-f-]{36})(_edited)?\.(heic|jpe?g|png|mov|mp4)$", re.I)
IMAGE_EXTENSIONS = {".heic", ".jpg", ".jpeg", ".png"}
VIDEO_EXTENSIONS = {".mov", ".mp4"}
REQUIRED_TOOLS = ("cwebp", "ffmpeg", "ffprobe", "swiftc")
DEFAULT_JOBS = min(4, os.cpu_count() or 1)
_NORMALIZER_LOCK = threading.Lock()
_NORMALIZER_BINARY: Path | None = None


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
    try:
        image_normalizer()
    except subprocess.CalledProcessError as error:
        raise PipelineError(f"Could not build the ImageIO helper: {error.stderr}") from error


def run(command: list[str]) -> None:
    result = subprocess.run(command, text=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if result.returncode:
        detail = result.stderr.strip() or f"exit code {result.returncode}"
        raise subprocess.CalledProcessError(result.returncode, command, stderr=detail)


def image_normalizer() -> Path:
    """Build and cache the small native helper that applies ImageIO transforms."""

    global _NORMALIZER_BINARY
    with _NORMALIZER_LOCK:
        if _NORMALIZER_BINARY and existing(_NORMALIZER_BINARY):
            return _NORMALIZER_BINARY
        resource = files("mediaforge").joinpath("image_normalizer.swift")
        source_bytes = resource.read_bytes()
        digest = hashlib.sha256(source_bytes).hexdigest()[:12]
        destination = Path(tempfile.gettempdir()) / f"mediaforge-image-normalizer-{digest}"
        if not existing(destination):
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=".mediaforge-image-normalizer-",
                dir=destination.parent,
            )
            os.close(descriptor)
            temporary = Path(temporary_name)
            temporary.unlink()
            try:
                with as_file(resource) as source:
                    run(["swiftc", "-O", str(source), "-o", str(temporary)])
                os.replace(temporary, destination)
            finally:
                temporary.unlink(missing_ok=True)
        _NORMALIZER_BINARY = destination
        return destination


def probe(path: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=index,codec_name,codec_type,width,height,pix_fmt:stream_tags=rotate:stream_side_data=rotation:format=duration",
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


def make_webp(source: Path, destination: Path, max_edge: int, *, force: bool = False) -> None:
    if existing(destination) and not force:
        return
    temporary, commit = atomic_destination(destination)
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            intermediate = Path(temp_dir) / "image.png"
            try:
                run(
                    [
                        str(image_normalizer()),
                        str(source),
                        str(intermediate),
                        str(max_edge),
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


def make_poster(source: Path, destination: Path, max_edge: int, *, force: bool = False) -> None:
    if existing(destination) and not force:
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
        if (
            video.get("codec_name") == "h264"
            and not stream_rotation(video)
            and (audio is None or audio.get("codec_name") == "aac")
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


def stream_rotation(stream: dict[str, Any]) -> int:
    """Return a stream's normalized clockwise display rotation."""

    values = [stream.get("tags", {}).get("rotate")]
    values.extend(item.get("rotation") for item in stream.get("side_data_list", []))
    for value in values:
        if value is not None:
            return round(float(value)) % 360
    return 0


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


def process_asset(
    asset: Asset,
    output: Path,
    *,
    force_images: bool = False,
) -> dict[str, Any]:
    small = output / "images" / f"{asset.uuid}-1280.webp"
    large = output / "images" / f"{asset.uuid}-2400.webp"
    if asset.image:
        make_webp(asset.image, small, 1280, force=force_images)
        make_webp(asset.image, large, 2400, force=force_images)
    elif asset.video:
        make_poster(asset.video, small, 1280, force=force_images)
        make_poster(asset.video, large, 2400, force=force_images)
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
    source: Path,
    output: Path,
    metadata: Path,
    *,
    limit: int | None = None,
    jobs: int = DEFAULT_JOBS,
    force_images: bool = False,
) -> tuple[int, list[dict[str, str]]]:
    if jobs < 1:
        raise PipelineError("Jobs must be at least 1")
    require_tools()
    assets = load_assets(source, metadata)
    if limit is not None:
        assets = select_sample(assets, limit)
    records_by_index: list[dict[str, Any] | None] = [None] * len(assets)
    failures_by_index: list[dict[str, str] | None] = [None] * len(assets)
    if assets:
        with ThreadPoolExecutor(
            max_workers=min(jobs, len(assets)),
            thread_name_prefix="mediaforge",
        ) as executor:
            futures: dict[Future[dict[str, Any]], tuple[int, Asset]] = {
                executor.submit(
                    process_asset,
                    asset,
                    output,
                    force_images=force_images,
                ): (index, asset)
                for index, asset in enumerate(assets)
            }
            for completed, future in enumerate(as_completed(futures), 1):
                index, asset = futures[future]
                try:
                    records_by_index[index] = future.result()
                    print(
                        f"[{completed}/{len(assets)}] {asset.kind}: {asset.uuid}",
                        flush=True,
                    )
                except Exception as error:
                    # Continue so one unusual asset cannot waste a long run.
                    message = (
                        error.stderr
                        if isinstance(error, subprocess.CalledProcessError) and error.stderr
                        else str(error)
                    )
                    failures_by_index[index] = {"id": asset.uuid, "error": message}
                    print(
                        f"[{completed}/{len(assets)}] ERROR {asset.uuid}: {message}",
                        flush=True,
                    )
    records = [record for record in records_by_index if record is not None]
    failures = [failure for failure in failures_by_index if failure is not None]
    manifest = {
        "schemaVersion": 1,
        "revision": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": source.as_posix(),
        "assets": records,
    }
    partial_manifest = output / "manifest.partial.json"
    final_manifest = output / "manifest.json"
    write_json_atomic(partial_manifest, manifest)
    if not failures:
        verification_errors = verify_manifest(
            output,
            manifest,
            expected={asset.uuid for asset in assets},
            deep=True,
        )
        failures.extend({"id": "verification", "error": error} for error in verification_errors)
    if failures:
        write_json_atomic(output / "errors.json", failures)
        final_manifest.unlink(missing_ok=True)
    else:
        os.replace(partial_manifest, final_manifest)
        (output / "errors.json").unlink(missing_ok=True)
    return len(records), failures


def verify_manifest(
    output: Path,
    manifest: dict[str, Any],
    *,
    expected: set[str],
    deep: bool = False,
) -> list[str]:
    errors: list[str] = []
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
        if record.get("video") and record.get("type") == "live_photo":
            image = record["image"]
            video = record["video"]
            image_orientation = (image["width"] > image["height"]) - (
                image["width"] < image["height"]
            )
            video_orientation = (video["width"] > video["height"]) - (
                video["width"] < video["height"]
            )
            if image_orientation and video_orientation and image_orientation != video_orientation:
                errors.append(f"Live Photo orientation differs: {record['id']}")
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


def verify_release(source: Path, output: Path, metadata: Path, *, deep: bool = False) -> list[str]:
    manifest_path = output / "manifest.json"
    if not manifest_path.is_file():
        return [f"Missing manifest: {manifest_path}"]
    manifest = json.loads(manifest_path.read_text())
    expected = {asset.uuid for asset in load_assets(source, metadata)}
    return verify_manifest(output, manifest, expected=expected, deep=deep)
