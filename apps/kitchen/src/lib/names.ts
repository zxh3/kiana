/**
 * A suggested name for a new sandbox.
 *
 * Naming a sandbox matters — it is the identity its snapshots hang off —
 * but most of the time nobody wants to think of one, and an empty required
 * field is a speed bump. So the create drawer opens with a readable suggestion
 * that can be replaced or reshuffled.
 *
 * Readable, not random: `sb-stable-scarlet-dragonfly` is easy to say out loud
 * and to recognise in a list, which a hash is not.
 */

import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { maxSandboxNameLength, sandboxNamePattern } from "$lib/types";

const PREFIX = "sb-";
const ATTEMPTS = 40;

function candidate(dictionaries: string[][]): string {
  return (
    PREFIX +
    uniqueNamesGenerator({
      dictionaries,
      separator: "-",
      length: dictionaries.length,
    })
  );
}

function usable(name: string, taken: string[]): boolean {
  return (
    name.length <= maxSandboxNameLength &&
    sandboxNamePattern.test(name) &&
    !taken.includes(name)
  );
}

/**
 * Three words normally fit the length limit, but the dictionaries can produce
 * `sb-magnificent-turquoise-hippopotamus` — well past it — so fall back to two
 * words, and finally to a timestamp that always fits.
 */
export function suggestName(taken: string[] = []): string {
  for (const dictionaries of [
    [adjectives, colors, animals],
    [colors, animals],
  ]) {
    for (let i = 0; i < ATTEMPTS; i++) {
      const name = candidate(dictionaries);
      if (usable(name, taken)) return name;
    }
  }
  return `${PREFIX}${Date.now().toString(36)}`;
}
