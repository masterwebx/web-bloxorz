import {
  LEVEL_WIDTH,
  LEVEL_HEIGHT,
  MAX_TILES,
  TILE,
  TILE_CHAR,
  BRIDGE_START_ON,
  SWITCH_MODE,
} from "./constants.js";
import { tileToIndex } from "./helpers.js";

function parseTiles(rows) {
  const tiles = new Array(MAX_TILES).fill(TILE.EMPTY);
  const bridgeStates = [];
  const bridges = [];

  for (let y = 0; y < LEVEL_HEIGHT; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < LEVEL_WIDTH; x++) {
      const ch = row[x] ?? " ";
      const tile = TILE_CHAR[ch] ?? TILE.EMPTY;
      const index = tileToIndex(x, y);
      tiles[index] = tile;

      if (tile === TILE.BRIDGE_LEFT || tile === TILE.BRIDGE_RIGHT) {
        bridges.push({
          index,
          type: tile === TILE.BRIDGE_RIGHT,
          state: BRIDGE_START_ON.has(ch),
          frame: BRIDGE_START_ON.has(ch) ? 7 : 0,
          highlightTimer: 0,
        });
        bridgeStates.push(BRIDGE_START_ON.has(ch));
      }
    }
  }

  return { tiles, bridges, bridgeStates };
}

function keyToTileIndex(key) {
  const wrongX = key % LEVEL_HEIGHT;
  const wrongY = Math.floor(key / LEVEL_HEIGHT);
  return wrongY + wrongX * LEVEL_WIDTH;
}

function parseSwitches(raw) {
  const switches = [];
  if (!raw) return switches;

  for (const [key, configs] of Object.entries(raw)) {
    const switchTileIndex = keyToTileIndex(parseInt(key, 10));
    for (const [bx, by, mode] of configs) {
      switches.push({
        switchTileIndex,
        bridgeTileIndex: tileToIndex(bx, by),
        mode: SWITCH_MODE[mode] ?? SWITCH_MODE.onoff,
      });
    }
  }
  return switches;
}

function parseSplits(raw) {
  const splits = [];
  if (!raw) return splits;

  for (const [key, [x1, y1, x2, y2]] of Object.entries(raw)) {
    splits.push({
      splitTileIndex: keyToTileIndex(parseInt(key, 10)),
      tile1Index: tileToIndex(x1, y1),
      tile2Index: tileToIndex(x2, y2),
    });
  }
  return splits;
}

export function parseLevels(json) {
  return json.levels.map((level, i) => {
    const { tiles, bridges, bridgeStates } = parseTiles(level.tiles);
    const spawn = level.spawn ?? [0, 0];
    let endPos = { x: -1, y: -1 };

    for (let idx = 0; idx < MAX_TILES; idx++) {
      if (tiles[idx] === TILE.END) {
        endPos = { x: idx % LEVEL_WIDTH, y: Math.floor(idx / LEVEL_WIDTH) };
      }
    }

    return {
      id: level.id,
      code: level.code,
      number: i + 1,
      tiles,
      spawn: { x: spawn[0], y: spawn[1] },
      endPos,
      bridges,
      bridgeStates,
      switches: parseSwitches(level.switches),
      splits: parseSplits(level.splits),
    };
  });
}

export async function loadLevels() {
  const res = await fetch("/assets/data/levels.json");
  const json = await res.json();
  return parseLevels(json);
}
