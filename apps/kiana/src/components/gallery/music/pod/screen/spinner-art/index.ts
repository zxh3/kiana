import type { KianaFace, SpinnerStyle } from "../../spinner";
import calm from "./kiana-calm.webp";
import curious from "./kiana-curious.webp";
import shades from "./kiana-shades.webp";
import claw from "./spinner-claw.webp";
import machined from "./spinner-machined.webp";
import stealth from "./spinner-stealth.webp";

/**
 * The finger spinner's art, generated with OpenAI's gpt-image-2.5-sunburst:
 * three spinners seen from above, each made exactly three-fold symmetric
 * about its centre so it turns without wobbling, and Kiana's face for the
 * cap, drawn from her photos. Each is three times its size on screen.
 */
export const spinnerArt: Record<SpinnerStyle, string> = {
  stealth,
  claw,
  machined,
};

export const kianaArt: Record<KianaFace, string> = { curious, calm, shades };
