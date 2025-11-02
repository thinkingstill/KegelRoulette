import { createAvatar } from "@dicebear/core";
import { micah } from "@dicebear/collection";

export async function avatarDataUri(seed: string) {
  const svg = createAvatar(micah, { seed, backgroundType: ["gradientLinear"], radius: 8 });
  return svg.toDataUri();
}

export function randomSeed() {
  const adjectives = ["swift", "calm", "brave", "sharp", "merry", "bright", "gentle", "lively", "bold", "clever"];
  const animals = ["fox", "panda", "tiger", "koala", "whale", "wolf", "otter", "owl", "eagle", "lion"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const b = animals[Math.floor(Math.random() * animals.length)];
  return `${a}-${b}-${Math.floor(Math.random() * 1000)}`;
}