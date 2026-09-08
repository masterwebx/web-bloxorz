export const LEVEL_WIDTH = 15;
export const LEVEL_HEIGHT = 10;
export const MAX_TILES = LEVEL_WIDTH * LEVEL_HEIGHT;

export const TILE = {
  EMPTY: 0,
  STONE: 1,
  END: 2,
  BRIDGE_LEFT: 3,
  BRIDGE_RIGHT: 4,
  SWITCH_O: 5,
  SWITCH_X: 6,
  RED: 7,
  SPLIT: 8,
};

export const TILE_CHAR = {
  " ": TILE.EMPTY,
  b: TILE.STONE,
  e: TILE.END,
  l: TILE.BRIDGE_LEFT,
  k: TILE.BRIDGE_LEFT,
  r: TILE.BRIDGE_RIGHT,
  q: TILE.BRIDGE_RIGHT,
  s: TILE.SWITCH_O,
  h: TILE.SWITCH_X,
  f: TILE.RED,
  v: TILE.SPLIT,
};

export const BRIDGE_START_ON = new Set(["k", "q"]);

export const ORIENTATION = { UP: 0, FORWARD: 1, RIGHT: 2 };

export const DIR = { FORWARD: 0, RIGHT: 1, BACK: 2, LEFT: 3 };

export const SWITCH = { ON: 0, OFF: 1, ON_OFF: 2 };

export const SWITCH_MODE = { on: SWITCH.ON, off: SWITCH.OFF, onoff: SWITCH.ON_OFF };

export const ROLL_MS = 280;
