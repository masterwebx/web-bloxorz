import { LEVEL_WIDTH } from "./constants.js";

export function tileToIndex(x, y) {
  return x + y * LEVEL_WIDTH;
}

export function indexToTile(index) {
  return { x: index % LEVEL_WIDTH, y: Math.floor(index / LEVEL_WIDTH) };
}

export function clonePos(p) {
  return { x: p.x, y: p.y };
}

export function posEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function pad(n, len, ch = "0") {
  return String(n).padStart(len, ch);
}

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Grid (x, row) -> Three.js (x, z) tile center on floor */
export function tileCenter(x, row) {
  return { x: x + 0.5, z: row + 0.5 };
}
