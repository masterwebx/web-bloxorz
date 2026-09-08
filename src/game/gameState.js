import {
  ORIENTATION,
  DIR,
  TILE,
  SWITCH,
} from "./constants.js";
import { tileToIndex, clonePos, posEqual } from "./helpers.js";

export class GameState {
  constructor(levels) {
    this.levels = levels;
    this.levelIndex = 0;
    this.moves = 0;
    this.fails = 0;
    this.attempts = 0;
    this.startTime = Date.now();
    this.phase = "menu";
    this.orientation = ORIENTATION.UP;
    this.pos = { x: 0, y: 0 };
    this.pos2 = { x: 0, y: 0 };
    this.endPos = { x: -1, y: -1 };
    this.bridges = [];
    this.isSplit = false;
    this.activeSplit = false;
  }

  get level() {
    return this.levels[this.levelIndex];
  }

  loadLevel(index, showTitle = true) {
    if (index >= this.levels.length) {
      this.phase = "complete";
      return;
    }

    const lv = this.levels[index];
    this.levelIndex = index;
    this.orientation = ORIENTATION.UP;
    this.pos = clonePos(lv.spawn);
    this.pos2 = { x: 0, y: 0 };
    this.endPos = clonePos(lv.endPos);
    this.bridges = lv.bridges.map((b) => ({ ...b, highlightTimer: 0 }));
    this.isSplit = false;
    this.activeSplit = false;
    this.attempts = 0;
    this.phase = showTitle ? "title" : "playing";
  }

  footprint() {
    if (this.isSplit) {
      return [
        { x: this.pos.x, y: this.pos.y },
        { x: this.pos2.x, y: this.pos2.y },
      ];
    }
    const cells = [{ x: this.pos.x, y: this.pos.y }];
    if (this.orientation === ORIENTATION.FORWARD) cells.push({ x: this.pos.x, y: this.pos.y + 1 });
    if (this.orientation === ORIENTATION.RIGHT) cells.push({ x: this.pos.x + 1, y: this.pos.y });
    return cells;
  }

  tileAt(x, y) {
    if (x < 0 || x >= 15 || y < 0 || y >= 10) return TILE.EMPTY;
    return this.level.tiles[tileToIndex(x, y)];
  }

  bridgeState(index) {
    const b = this.bridges.find((br) => br.index === index);
    return b ? b.state : false;
  }

  isSupported(cell) {
    const t = this.tileAt(cell.x, cell.y);
    if (t === TILE.EMPTY) return false;
    if (t === TILE.BRIDGE_LEFT || t === TILE.BRIDGE_RIGHT) {
      return this.bridgeState(tileToIndex(cell.x, cell.y));
    }
    return true;
  }

  isValidLanding() {
    const [a, b] = this.footprint();
    if (!this.isSupported(a)) return false;
    if (b && !this.isSupported(b)) return false;
    if (!this.isSplit && this.orientation === ORIENTATION.UP && this.tileAt(a.x, a.y) === TILE.RED) {
      return false;
    }
    return true;
  }

  applyMove(dir) {
    if (this.isSplit) return this.applySplitMove(dir);

    const o = this.orientation;
    const p = this.pos;

    if (dir === DIR.FORWARD) {
      if (o === ORIENTATION.UP) {
        this.orientation = ORIENTATION.FORWARD;
        p.y -= 2;
      } else if (o === ORIENTATION.FORWARD) {
        this.orientation = ORIENTATION.UP;
        p.y -= 1;
      } else {
        p.y -= 1;
      }
    } else if (dir === DIR.BACK) {
      if (o === ORIENTATION.UP) {
        this.orientation = ORIENTATION.FORWARD;
        p.y += 1;
      } else if (o === ORIENTATION.FORWARD) {
        this.orientation = ORIENTATION.UP;
        p.y += 2;
      } else {
        p.y += 1;
      }
    } else if (dir === DIR.LEFT) {
      if (o === ORIENTATION.UP) {
        this.orientation = ORIENTATION.RIGHT;
        p.x -= 2;
      } else if (o === ORIENTATION.RIGHT) {
        this.orientation = ORIENTATION.UP;
        p.x -= 1;
      } else {
        p.x -= 1;
      }
    } else if (dir === DIR.RIGHT) {
      if (o === ORIENTATION.UP) {
        this.orientation = ORIENTATION.RIGHT;
        p.x += 1;
      } else if (o === ORIENTATION.RIGHT) {
        this.orientation = ORIENTATION.UP;
        p.x += 2;
      } else {
        p.x += 1;
      }
    }
  }

  applySplitMove(dir) {
    const p = this.activeSplit ? this.pos2 : this.pos;
    if (dir === DIR.FORWARD) p.y -= 1;
    else if (dir === DIR.BACK) p.y += 1;
    else if (dir === DIR.LEFT) p.x -= 1;
    else if (dir === DIR.RIGHT) p.x += 1;
  }

  triggerSwitches() {
    const [c1, c2] = this.footprint();
    const i1 = tileToIndex(c1.x, c1.y);
    const t1 = this.tileAt(c1.x, c1.y);

    if (
      (t1 === TILE.SWITCH_O && (!this.isSplit || !this.activeSplit)) ||
      (!this.isSplit && this.orientation === ORIENTATION.UP && t1 === TILE.SWITCH_X)
    ) {
      this.pressSwitch(i1);
    }

    if (c2) {
      const t2 = this.tileAt(c2.x, c2.y);
      if (t2 === TILE.SWITCH_O && (!this.isSplit || this.activeSplit)) {
        this.pressSwitch(tileToIndex(c2.x, c2.y));
      }
    }
  }

  pressSwitch(switchIndex) {
    for (const cfg of this.level.switches) {
      if (cfg.switchTileIndex !== switchIndex) continue;
      const b = this.bridges.find((br) => br.index === cfg.bridgeTileIndex);
      if (!b) continue;
      if (cfg.mode === SWITCH.ON_OFF) b.state = !b.state;
      else if (cfg.mode === SWITCH.ON) b.state = true;
      else if (cfg.mode === SWITCH.OFF) b.state = false;
      b.highlightTimer = 30;
    }
  }

  trySplit() {
    if (this.isSplit) return false;
    if (this.orientation !== ORIENTATION.UP) return false;
    const t = this.tileAt(this.pos.x, this.pos.y);
    if (t !== TILE.SPLIT) return false;

    const cfg = this.level.splits.find((s) => s.splitTileIndex === tileToIndex(this.pos.x, this.pos.y));
    if (!cfg) return false;

    this.isSplit = true;
    this.activeSplit = false;
    this.pos = { x: cfg.tile1Index % 15, y: Math.floor(cfg.tile1Index / 15) };
    this.pos2 = { x: cfg.tile2Index % 15, y: Math.floor(cfg.tile2Index / 15) };
    return true;
  }

  tryJoin() {
    if (!this.isSplit) return false;
    const xNear = this.pos.y === this.pos2.y && Math.abs(this.pos.x - this.pos2.x) <= 1;
    const yNear = this.pos.x === this.pos2.x && Math.abs(this.pos.y - this.pos2.y) <= 1;
    if (!xNear && !yNear) return false;

    this.isSplit = false;
    this.activeSplit = false;
    if (xNear) {
      this.orientation = ORIENTATION.RIGHT;
      this.pos.x = Math.min(this.pos.x, this.pos2.x);
    } else {
      this.orientation = ORIENTATION.FORWARD;
      this.pos.y = Math.min(this.pos.y, this.pos2.y);
    }
    return true;
  }

  isWin() {
    return (
      !this.isSplit &&
      this.orientation === ORIENTATION.UP &&
      posEqual(this.pos, this.endPos)
    );
  }

  toggleSplitControl() {
    if (!this.isSplit) return;
    this.activeSplit = !this.activeSplit;
  }

  findLevelByCode(code) {
    const lv = this.levels.find((l) => l.code === code);
    return lv ? lv.number - 1 : -1;
  }
}
