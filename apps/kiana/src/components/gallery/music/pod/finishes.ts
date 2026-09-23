import type { CSSProperties } from "react";

export const finishes = ["silver", "graphite", "rose"] as const;
export type Finish = (typeof finishes)[number];

export const finishLabels: Record<Finish, string> = {
  silver: "Silver",
  graphite: "Graphite",
  rose: "Rose",
};

export function parseFinish(raw: string | null): Finish {
  return finishes.includes(raw as Finish) ? (raw as Finish) : "silver";
}

export function nextFinish(finish: Finish): Finish {
  return finishes[(finishes.indexOf(finish) + 1) % finishes.length];
}

/**
 * Anodised aluminium in three colours. The player reads these variables:
 * the body, its rim highlight, the wheel, the wheel's printing, and the
 * centre button.
 */
export const finishStyles: Record<Finish, CSSProperties> = {
  silver: {
    "--pod-body":
      "linear-gradient(155deg, #f4f4f2 0%, #d9d9d6 42%, #c3c3bf 100%)",
    "--pod-rim": "rgb(255 255 255 / 0.85)",
    "--pod-wheel": "#fbfbfa",
    "--pod-wheel-edge": "rgb(0 0 0 / 0.14)",
    "--pod-print": "#a3a3a0",
    "--pod-center": "linear-gradient(180deg, #f1f1ef 0%, #e2e2df 100%)",
  } as CSSProperties,
  graphite: {
    "--pod-body":
      "linear-gradient(155deg, #55555a 0%, #333337 45%, #222225 100%)",
    "--pod-rim": "rgb(255 255 255 / 0.22)",
    "--pod-wheel": "#1c1c1f",
    "--pod-wheel-edge": "rgb(0 0 0 / 0.5)",
    "--pod-print": "#8d8d93",
    "--pod-center": "linear-gradient(180deg, #2c2c30 0%, #1d1d20 100%)",
  } as CSSProperties,
  rose: {
    "--pod-body":
      "linear-gradient(155deg, #f8ccd1 0%, #eca3ad 45%, #dc8b98 100%)",
    "--pod-rim": "rgb(255 255 255 / 0.6)",
    "--pod-wheel": "#fcf8f7",
    "--pod-wheel-edge": "rgb(120 40 55 / 0.16)",
    "--pod-print": "#c48893",
    "--pod-center": "linear-gradient(180deg, #faf1f0 0%, #efe2e1 100%)",
  } as CSSProperties,
};
