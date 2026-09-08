import { LEVEL_WIDTH } from "./constants.js";

export function indexToTilePos(index) {
  return { x: index % LEVEL_WIDTH, y: Math.floor(index / LEVEL_WIDTH) };
}

export function tileToIndex(x, y) {
  return x + y * LEVEL_WIDTH;
}

export function tileToScreenGrid(tile) {
  return {
    x: tile.x * 13 + tile.y * 4,
    y: tile.y * 7 - tile.x * 2,
  };
}

export function blockTileToScreenPos(tile) {
  const p = tileToScreenGrid(tile);
  return { x: p.x - 133, y: p.y - 42 };
}

export function bridgeTileToScreenPos(tile) {
  const p = tileToScreenGrid(tile);
  return { x: p.x - 112, y: p.y - 9 };
}

export function padNumber(num, length, padChar = "0") {
  const s = String(num);
  return s.padStart(length, padChar);
}

export function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clonePoint(p) {
  return { x: p.x, y: p.y };
}

export function pointsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}
