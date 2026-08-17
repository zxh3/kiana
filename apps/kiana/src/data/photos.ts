export type GalleryPhoto = {
  id: string;
  date: string;
  small: string;
  large: string;
  width: number;
  height: number;
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

function releaseUrl(value: string) {
  const normalized = value.endsWith("/") ? value : `${value}/`;
  return new URL(normalized);
}

export function parseMediaforgeManifest(
  value: unknown,
  mediaReleaseUrl: string,
): GalleryPhoto[] {
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
    const date = requiredString(asset.date, `assets[${index}].date`);
    if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
      throw new Error(
        `Invalid Mediaforge manifest: assets[${index}].date is not an ISO date`,
      );
    }

    return {
      id: requiredString(asset.id, `assets[${index}].id`),
      date: date.slice(0, 10),
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

export async function loadGalleryPhotos(): Promise<GalleryPhoto[]> {
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
