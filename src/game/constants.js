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

export const ORIENTATION = {
  UP: 0,
  FORWARD: 1,
  RIGHT: 2,
};

export const DIR = {
  FORWARD: 0,
  RIGHT: 1,
  BACK: 2,
  LEFT: 3,
};

export const SWITCH = {
  ON: 0,
  OFF: 1,
  ON_OFF: 2,
};

export const SWITCH_MODE = {
  on: SWITCH.ON,
  off: SWITCH.OFF,
  onoff: SWITCH.ON_OFF,
};

export const SCENE = {
  SPLASH: "splash",
  MENU: "menu",
  TUTORIAL: "tutorial",
  LEVEL: "level",
  CONGRATS: "congrats",
};

export const FALL_FRAMES = 12;
export const SPLIT_HIGHLIGHT_FRAMES = 20;
export const BRIDGE_HIGHLIGHT_FRAMES = 8;
export const TITLE_FRAMES = 240;
export const INVALID_CODE_FRAMES = 60;
export const CANVAS_W = 480;
export const CANVAS_H = 320;
export const SCALE = 2;
export const GBA_W = 240;
export const GBA_H = 160;

export const ANIM = {
  BLOCK_UP: 0,
  BLOCK_UP_MOVE_FORWARD: 1,
  BLOCK_UP_MOVE_RIGHT: 2,
  BLOCK_UP_MOVE_BACK: 3,
  BLOCK_UP_MOVE_LEFT: 4,
  BLOCK_FORWARD: 5,
  BLOCK_FORWARD_MOVE_FORWARD: 6,
  BLOCK_FORWARD_MOVE_RIGHT: 7,
  BLOCK_FORWARD_MOVE_BACK: 8,
  BLOCK_FORWARD_MOVE_LEFT: 9,
  BLOCK_RIGHT: 10,
  BLOCK_RIGHT_MOVE_FORWARD: 11,
  BLOCK_RIGHT_MOVE_RIGHT: 12,
  BLOCK_RIGHT_MOVE_BACK: 13,
  BLOCK_RIGHT_MOVE_LEFT: 14,
  BLOCK_CUBE: 15,
  BLOCK_CUBE_MOVE_FORWARD: 16,
  BLOCK_CUBE_MOVE_RIGHT: 17,
  BLOCK_CUBE_MOVE_BACK: 18,
  BLOCK_CUBE_MOVE_LEFT: 19,
  BLOCK_SINK: 20,
  BLOCK_SPIN_BACK: 21,
};

export const BLOCK_ANIMATIONS = [
  { frames: [0], offsets: [[31, 14]], loop: false },
  { frames: [1, 2, 3, 4, 5, 6, 7, 8], offsets: [[31, 14], [31, 13], [30, 12], [29, 11], [28, 10], [26, 8], [25, 8], [24, 9]], loop: false },
  { frames: [9, 10, 11, 12, 13, 14, 15, 16], offsets: [[31, 14], [31, 14], [32, 14], [32, 12], [33, 11], [35, 11], [37, 12], [40, 15]], loop: false },
  { frames: [17, 18, 19, 20, 21, 22, 23, 24], offsets: [[31, 14], [31, 14], [31, 15], [32, 16], [32, 18], [32, 22], [33, 28], [34, 30]], loop: false },
  { frames: [25, 26, 27, 28, 29, 30, 31, 32], offsets: [[31, 14], [29, 14], [27, 13], [24, 13], [20, 14], [15, 15], [11, 19], [8, 24]], loop: false },
  { frames: [33], offsets: [[31, 26]], loop: false },
  { frames: [34, 35, 36, 37, 38, 39, 40, 41], offsets: [[31, 26], [31, 25], [31, 25], [30, 24], [29, 24], [29, 20], [28, 14], [27, 10]], loop: false },
  { frames: [42, 43, 44, 45, 46, 47, 48, 49], offsets: [[31, 26], [31, 26], [32, 26], [32, 24], [33, 23], [34, 22], [37, 21], [40, 22]], loop: false },
  { frames: [50, 51, 52, 53, 54, 55, 56, 57], offsets: [[31, 26], [31, 25], [31, 23], [32, 22], [32, 21], [33, 21], [35, 23], [37, 25]], loop: false },
  { frames: [58, 59, 60, 61, 62, 63, 64, 65], offsets: [[31, 26], [30, 25], [29, 25], [28, 24], [26, 23], [23, 23], [21, 24], [20, 26]], loop: false },
  { frames: [66], offsets: [[31, 23]], loop: false },
  { frames: [67, 68, 69, 70, 71, 72, 73, 74], offsets: [[31, 23], [31, 23], [30, 22], [30, 21], [29, 21], [28, 19], [27, 17], [27, 16]], loop: false },
  { frames: [75, 76, 77, 78, 79, 80, 81, 82], offsets: [[31, 23], [32, 23], [32, 23], [33, 20], [34, 17], [37, 13], [42, 10], [49, 9]], loop: false },
  { frames: [83, 84, 85, 86, 87, 88, 89, 90], offsets: [[31, 23], [31, 23], [32, 23], [32, 23], [32, 23], [33, 25], [33, 27], [34, 28]], loop: false },
  { frames: [91, 92, 93, 94, 95, 96, 97, 98], offsets: [[31, 23], [30, 22], [29, 20], [28, 18], [26, 16], [24, 14], [21, 13], [20, 14]], loop: false },
  { frames: [99], offsets: [[31, 25]], loop: false },
  { frames: [100, 101, 102, 103, 104, 105, 106, 107], offsets: [[31, 25], [31, 25], [31, 24], [30, 24], [29, 24], [29, 21], [28, 19], [28, 18]], loop: false },
  { frames: [108, 109, 110, 111, 112, 113, 114, 115], offsets: [[31, 25], [31, 25], [32, 25], [32, 24], [33, 22], [35, 21], [37, 21], [40, 21]], loop: false },
  { frames: [116, 117, 118, 119, 120, 121, 122, 123], offsets: [[31, 25], [31, 25], [31, 25], [32, 25], [32, 25], [32, 26], [33, 29], [34, 30]], loop: false },
  { frames: [124, 125, 126, 127, 128, 129, 130, 131], offsets: [[31, 25], [30, 25], [29, 24], [28, 23], [26, 23], [24, 23], [21, 24], [20, 26]], loop: false },
  { frames: [132, 133, 134, 135, 136, 137, 138, 139], offsets: [[31, 14], [31, 15], [31, 16], [31, 19], [31, 23], [31, 28], [31, 34], [34, 41]], loop: false },
  { frames: [0, 140, 141, 142, 143, 144, 145, 146, 147], offsets: [[31, 14], [30, 15], [29, 18], [29, 22], [29, 18], [29, 15], [29, 14], [29, 14], [30, 14]], loop: true },
];

export const TUTORIAL_PAGES = [
  "Roll the block into the square hole to advance to the next stage.",
  "Use the arrow keys to roll the block in four directions.",
  "Round switches open and close bridges. X switches only work when the block stands upright on them.",
  "Orange tiles are fragile. The block will fall through if it stands upright on them.",
  "Split pads divide the block into two smaller cubes. Press Space to switch control between them.",
  "When the two cubes are next to each other, they join back into one block.",
  "Each stage has a passcode. Write it down so you can return later.",
  "Enter a passcode from the main menu to jump to that stage.",
  "Good luck!",
];
