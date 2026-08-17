import { describe, expect, it } from "vitest";

import { parseMediaforgeManifest } from "./photos";

const image = {
  small: "images/example-1280.webp",
  large: "images/example-2400.webp",
  width: 2400,
  height: 1800,
};

const video = {
  src: "videos/example.mp4",
  width: 1920,
  height: 1080,
  durationMs: 2950,
};

describe("parseMediaforgeManifest", () => {
  it("accepts nullable dates and resolves photo, Live Photo, and video assets", () => {
    const assets = parseMediaforgeManifest(
      {
        schemaVersion: 1,
        assets: [
          { id: "photo", type: "photo", date: null, image },
          {
            id: "live",
            type: "live_photo",
            date: "2026-07-14T13:09:01-07:00",
            image,
            video,
          },
          {
            id: "video",
            type: "video",
            date: "2022-08-28T00:55:05-07:00",
            image,
            video,
          },
        ],
      },
      "https://media.kiana.me/releases/current",
    );

    expect(assets[0].date).toBeNull();
    expect(assets[1]).toMatchObject({
      type: "live_photo",
      date: "2026-07-14",
      video: {
        src: "https://media.kiana.me/releases/current/videos/example.mp4",
        durationMs: 2950,
      },
    });
    expect(assets[2].type).toBe("video");
  });

  it("requires moving assets to include video metadata", () => {
    expect(() =>
      parseMediaforgeManifest(
        {
          schemaVersion: 1,
          assets: [{ id: "video", type: "video", date: null, image }],
        },
        "https://media.kiana.me/releases/current",
      ),
    ).toThrow("assets[0].video must be an object");
  });
});
