export type GalleryVideo = {
  src: string;
  width: number;
  height: number;
  durationMs: number;
};

export type GalleryAsset = {
  id: string;
  type: "photo" | "live_photo" | "video";
  date: string | null;
  small: string;
  large: string;
  width: number;
  height: number;
  video?: GalleryVideo;
};

const DEFAULT_MEDIA_RELEASE_URL = "https://media.kiana.me/releases/current";

function requiredRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid Mediaforge manifest: ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(
      `Invalid Mediaforge manifest: ${label} must be a non-empty string`,
    );
  }
  return value;
}

function requiredPositiveNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Invalid Mediaforge manifest: ${label} must be a positive number`,
    );
  }
  return value;
}

function optionalDate(value: unknown, label: string) {
  if (value === null || value === undefined) return null;
  const date = requiredString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
    throw new Error(`Invalid Mediaforge manifest: ${label} is not an ISO date`);
  }
  return date.slice(0, 10);
}

function requiredMediaType(
  value: unknown,
  label: string,
): GalleryAsset["type"] {
  if (value !== "photo" && value !== "live_photo" && value !== "video") {
    throw new Error(
      `Invalid Mediaforge manifest: ${label} is not a supported media type`,
    );
  }
  return value;
}

function releaseUrl(value: string) {
  const normalized = value.endsWith("/") ? value : `${value}/`;
  return new URL(normalized);
}

export function parseMediaforgeManifest(
  value: unknown,
  mediaReleaseUrl: string,
): GalleryAsset[] {
  const manifest = requiredRecord(value, "root");
  if (manifest.schemaVersion !== 1) {
    throw new Error("Unsupported Mediaforge manifest schema");
  }
  if (!Array.isArray(manifest.assets)) {
    throw new Error("Invalid Mediaforge manifest: assets must be an array");
  }

  const baseUrl = releaseUrl(mediaReleaseUrl);
  const photos = manifest.assets.map((value, index) => {
    const asset = requiredRecord(value, `assets[${index}]`);
    const image = requiredRecord(asset.image, `assets[${index}].image`);
    const type = requiredMediaType(asset.type, `assets[${index}].type`);
    const video =
      type === "photo"
        ? undefined
        : requiredRecord(asset.video, `assets[${index}].video`);

    return {
      id: requiredString(asset.id, `assets[${index}].id`),
      type,
      date: optionalDate(asset.date, `assets[${index}].date`),
      small: new URL(
        requiredString(image.small, `assets[${index}].image.small`),
        baseUrl,
      ).href,
      large: new URL(
        requiredString(image.large, `assets[${index}].image.large`),
        baseUrl,
      ).href,
      width: requiredPositiveNumber(
        image.width,
        `assets[${index}].image.width`,
      ),
      height: requiredPositiveNumber(
        image.height,
        `assets[${index}].image.height`,
      ),
      video: video
        ? {
            src: new URL(
              requiredString(video.src, `assets[${index}].video.src`),
              baseUrl,
            ).href,
            width: requiredPositiveNumber(
              video.width,
              `assets[${index}].video.width`,
            ),
            height: requiredPositiveNumber(
              video.height,
              `assets[${index}].video.height`,
            ),
            durationMs: requiredPositiveNumber(
              video.durationMs,
              `assets[${index}].video.durationMs`,
            ),
          }
        : undefined,
    };
  });

  if (photos.length === 0) {
    throw new Error("Mediaforge manifest does not contain any assets");
  }
  if (new Set(photos.map((photo) => photo.id)).size !== photos.length) {
    throw new Error("Mediaforge manifest contains duplicate asset IDs");
  }
  return photos;
}

export async function loadGalleryAssets(): Promise<GalleryAsset[]> {
  const mediaReleaseUrl =
    import.meta.env.VITE_KIANA_MEDIA_BASE_URL?.trim() ||
    DEFAULT_MEDIA_RELEASE_URL;

  const manifestUrl = new URL("manifest.json", releaseUrl(mediaReleaseUrl));
  const response = await fetch(manifestUrl, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Unable to load Kiana media manifest (${response.status})`);
  }

  return parseMediaforgeManifest(await response.json(), mediaReleaseUrl);
}
