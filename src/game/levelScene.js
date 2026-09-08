import {
  ORIENTATION,
  DIR,
  TILE,
  SWITCH,
  ANIM,
  FALL_FRAMES,
  SPLIT_HIGHLIGHT_FRAMES,
  BRIDGE_HIGHLIGHT_FRAMES,
  TITLE_FRAMES,
} from "./constants.js";
import {
  tileToIndex,
  blockTileToScreenPos,
  clonePoint,
  pointsEqual,
  formatTime,
} from "./helpers.js";
import { AnimationPlayer } from "./animation.js";

export class LevelScene {
  constructor(levels, audio, renderer, shared) {
    this.levels = levels;
    this.audio = audio;
    this.renderer = renderer;
    this.shared = shared;

    this.currentLevelIndex = 0;
    this.movesCount = 0;
    this.attemptsCount = 0;
    this.failedCount = 0;
    this.timerStart = Date.now();

    this.blockOrientation = ORIENTATION.UP;
    this.blockPos = { x: 0, y: 0 };
    this.block2Pos = { x: 0, y: 0 };
    this.endTilePos = { x: -1, y: -1 };
    this.bridges = [];
    this.isSplit = false;
    this.activeSplit = false;
    this.activeSplitHighlightTimer = SPLIT_HIGHLIGHT_FRAMES;

    this.blockPlayer = new AnimationPlayer();
    this.block2Player = new AnimationPlayer();

    this.state = "playing";
    this.titleTimer = 0;
    this.fallAnimTimer = 0;
    this.fallAnimStart = null;
    this.blockVisible = true;
    this.blockAlpha = 1;
    this.mosaic = 0;
    this.paused = false;
    this.pauseOption = 0;
    this.inputLocked = false;
    this.pendingReload = false;

    this.keys = {};
  }

  start(levelIndex = 0) {
    this.currentLevelIndex = levelIndex;
    if (levelIndex === 0) {
      this.movesCount = 0;
      this.failedCount = 0;
      this.timerStart = Date.now();
    }
    this.loadLevel(levelIndex, true);
  }

  loadLevel(index, showTitle = false) {
    if (index >= this.levels.length) {
      this.state = "congrats";
      this.audio.playMusic("menu");
      return;
    }

    const level = this.levels[index];
    this.currentLevelIndex = index;
    this.isSplit = false;
    this.activeSplit = false;
    this.blockOrientation = ORIENTATION.UP;
    this.blockPos = clonePoint(level.spawn);
    this.endTilePos = clonePoint(level.endPos);
    this.bridges = level.bridges.map((b) => ({ ...b, frame: b.state ? 7 : 0, highlightTimer: 0 }));
    this.blockVisible = true;
    this.blockAlpha = 1;
    this.mosaic = 0;
    this.renderer.setMosaic(0);
    this.inputLocked = false;

    this.blockPlayer.setAnimation(ANIM.BLOCK_UP);
    this.blockPlayer.basePosition = blockTileToScreenPos(this.blockPos);

    if (showTitle) {
      this.state = "title";
      this.titleTimer = TITLE_FRAMES;
      this.attemptsCount = 0;
      this.audio.play("title_card");
    } else {
      this.state = "drop_in";
      this.fallAnimTimer = 0;
    }

    const anyBridgeOn = this.bridges.some((b) => b.state);
    if (anyBridgeOn) this.audio.play("bridge_enabled");
    this.audio.play("drop_in");
    this.audio.playMusic("ambient", 0.7);
  }

  getLevel() {
    return this.levels[this.currentLevelIndex];
  }

  handleKeyDown(code) {
    this.keys[code] = true;
  }

  handleKeyUp(code) {
    this.keys[code] = false;
  }

  update() {
    if (this.state === "congrats") {
      if (this.keys["Space"] || this.keys["Escape"]) {
        return "menu";
      }
      return null;
    }

    if (this.state === "title") {
      if (this.keys["Space"] || this.keys["Enter"]) {
        this.keys["Space"] = false;
        this.keys["Enter"] = false;
        this.state = "drop_in";
        this.fallAnimTimer = 0;
        return null;
      }
      this.titleTimer--;
      if (this.titleTimer <= 0) {
        this.state = "drop_in";
        this.fallAnimTimer = 0;
      }
      return null;
    }

    if (this.state === "drop_in") {
      this.fallAnimTimer++;
      const start = blockTileToScreenPos(this.blockPos);
      const y = start.y - (FALL_FRAMES - this.fallAnimTimer) * 12;
      this.blockPlayer.basePosition = { x: start.x, y };
      if (this.fallAnimTimer >= FALL_FRAMES) {
        this.blockPlayer.basePosition = start;
        this.setIdleAnimation();
        this.state = "playing";
      }
      return null;
    }

    if (this.state === "animating") {
      const activePlayer =
        this.isSplit && this.activeSplit ? this.block2Player : this.blockPlayer;
      const finished = activePlayer.update();
      if (finished) {
        this.afterMove();
      }
      return null;
    }

    if (this.state === "fail") {
      this.failTimer++;
      this.blockPlayer.basePosition.y += 1;
      this.mosaic = Math.min(0.5, this.failTimer * 0.025);
      this.renderer.setMosaic(this.mosaic * 8);
      if (this.failTimer >= 20) {
        this.attemptsCount++;
        this.failedCount++;
        this.loadLevel(this.currentLevelIndex, false);
      }
      return null;
    }

    if (this.state === "win") {
      this.winTimer++;
      if (this.winTimer === 1) {
        this.blockPlayer.setAnimation(ANIM.BLOCK_SINK);
        this.blockPlayer.playUntilDone();
      }
      if (this.winTimer < 4) return null;
      if (!this.blockPlayer.isDone()) {
        this.blockPlayer.update();
        return null;
      }
      if (this.winTimer === 16) {
        this.audio.play("whoosh");
        this.mosaic = 0.05;
      }
      if (this.winTimer > 16) {
        this.mosaic = Math.min(0.5, (this.winTimer - 16) * 0.05);
        this.renderer.setMosaic(this.mosaic * 8);
      }
      if (this.winTimer >= 28) {
        this.loadLevel(this.currentLevelIndex + 1, true);
      }
      return null;
    }

    if (this.state === "split_anim") {
      this.splitTimer++;
      return null;
    }

    if (this.paused) {
      return this.updatePause();
    }

    if (this.inputLocked) return null;

    if (this.keys["Escape"]) {
      this.keys["Escape"] = false;
      this.paused = true;
      this.pauseOption = 0;
      this.audio.play("click");
      return null;
    }

    let moved = false;
    let dir = null;

    if (this.keys["ArrowUp"]) { dir = DIR.FORWARD; moved = true; }
    else if (this.keys["ArrowDown"]) { dir = DIR.BACK; moved = true; }
    else if (this.keys["ArrowLeft"]) { dir = DIR.LEFT; moved = true; }
    else if (this.keys["ArrowRight"]) { dir = DIR.RIGHT; moved = true; }

    if (moved) {
      this.keys["ArrowUp"] = false;
      this.keys["ArrowDown"] = false;
      this.keys["ArrowLeft"] = false;
      this.keys["ArrowRight"] = false;
      this.move(dir);
      return null;
    }

    if (this.keys["Space"] && this.isSplit) {
      this.keys["Space"] = false;
      this.activeSplit = !this.activeSplit;
      this.activeSplitHighlightTimer = 0;
    }

    this.updateBridges();
    return null;
  }

  move(direction) {
    if (this.isSplit) {
      this.moveSplit(direction);
      (this.activeSplit ? this.block2Player : this.blockPlayer).playUntilDone();
    } else {
      this.moveBlock(direction);
      this.blockPlayer.playUntilDone();
    }
    this.movesCount++;
    this.state = "animating";
  }

  moveSplit(direction) {
    const pos = this.activeSplit ? this.block2Pos : this.blockPos;
    const player = this.activeSplit ? this.block2Player : this.blockPlayer;

    if (direction === DIR.FORWARD) {
      pos.y -= 1;
      player.setAnimation(ANIM.BLOCK_CUBE_MOVE_FORWARD);
    } else if (direction === DIR.BACK) {
      pos.y += 1;
      player.setAnimation(ANIM.BLOCK_CUBE_MOVE_BACK);
    } else if (direction === DIR.LEFT) {
      pos.x -= 1;
      player.setAnimation(ANIM.BLOCK_CUBE_MOVE_LEFT);
    } else if (direction === DIR.RIGHT) {
      pos.x += 1;
      player.setAnimation(ANIM.BLOCK_CUBE_MOVE_RIGHT);
    }

    player.basePosition = blockTileToScreenPos(pos);
  }

  moveBlock(direction) {
    const o = this.blockOrientation;

    if (direction === DIR.FORWARD) {
      if (o === ORIENTATION.UP) {
        this.blockOrientation = ORIENTATION.FORWARD;
        this.blockPos.y -= 2;
        this.blockPlayer.setAnimation(ANIM.BLOCK_UP_MOVE_FORWARD);
      } else if (o === ORIENTATION.FORWARD) {
        this.blockOrientation = ORIENTATION.UP;
        this.blockPos.y -= 1;
        this.blockPlayer.setAnimation(ANIM.BLOCK_FORWARD_MOVE_FORWARD);
      } else {
        this.blockPos.y -= 1;
        this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT_MOVE_FORWARD);
      }
    } else if (direction === DIR.BACK) {
      if (o === ORIENTATION.UP) {
        this.blockOrientation = ORIENTATION.FORWARD;
        this.blockPos.y += 1;
        this.blockPlayer.setAnimation(ANIM.BLOCK_UP_MOVE_BACK);
      } else if (o === ORIENTATION.FORWARD) {
        this.blockOrientation = ORIENTATION.UP;
        this.blockPos.y += 2;
        this.blockPlayer.setAnimation(ANIM.BLOCK_FORWARD_MOVE_BACK);
      } else {
        this.blockPos.y += 1;
        this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT_MOVE_BACK);
      }
    } else if (direction === DIR.LEFT) {
      if (o === ORIENTATION.UP) {
        this.blockOrientation = ORIENTATION.RIGHT;
        this.blockPos.x -= 2;
        this.blockPlayer.setAnimation(ANIM.BLOCK_UP_MOVE_LEFT);
      } else if (o === ORIENTATION.RIGHT) {
        this.blockOrientation = ORIENTATION.UP;
        this.blockPos.x -= 1;
        this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT_MOVE_LEFT);
      } else {
        this.blockPos.x -= 1;
        this.blockPlayer.setAnimation(ANIM.BLOCK_FORWARD_MOVE_LEFT);
      }
    } else if (direction === DIR.RIGHT) {
      if (o === ORIENTATION.UP) {
        this.blockOrientation = ORIENTATION.RIGHT;
        this.blockPos.x += 1;
        this.blockPlayer.setAnimation(ANIM.BLOCK_UP_MOVE_RIGHT);
      } else if (o === ORIENTATION.RIGHT) {
        this.blockOrientation = ORIENTATION.UP;
        this.blockPos.x += 2;
        this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT_MOVE_RIGHT);
      } else {
        this.blockPos.x += 1;
        this.blockPlayer.setAnimation(ANIM.BLOCK_FORWARD_MOVE_RIGHT);
      }
    }

    this.blockPlayer.basePosition = blockTileToScreenPos(this.blockPos);
  }

  afterMove() {
    if (this.state !== "animating") return;

    const level = this.getLevel();

    if (!this.isSplit && this.blockOrientation === ORIENTATION.UP && pointsEqual(this.blockPos, this.endTilePos)) {
      this.state = "win";
      this.winTimer = 0;
      this.blockPlayer.setAnimation(ANIM.BLOCK_SINK);
      return;
    }

    const { tile1, tile2, tileIndex1, tileIndex2 } = this.getFootprintTiles();

    const hollow = [tile1, tile2].some(
      (t) => t === TILE.RED || t === TILE.BRIDGE_LEFT || t === TILE.BRIDGE_RIGHT
    );
    this.audio.playMove(hollow);

    if (!this.isValidPosition(tile1, tile2, tileIndex1, tileIndex2)) {
      this.state = "fail";
      this.failTimer = 0;
      this.blockAlpha = 0.5;
      this.audio.play("fail");
      return;
    }

    if (
      (tile1 === TILE.SWITCH_O && (!this.isSplit || !this.activeSplit)) ||
      (!this.isSplit && this.blockOrientation === ORIENTATION.UP && tile1 === TILE.SWITCH_X)
    ) {
      this.switchPressed(tileIndex1);
    }
    if (tile2 === TILE.SWITCH_O && (!this.isSplit || this.activeSplit)) {
      this.switchPressed(tileIndex2);
    }

    if (!this.isSplit && this.blockOrientation === ORIENTATION.UP && tile1 === TILE.SPLIT) {
      this.doSplit(tileIndex1);
      return;
    }

    this.tryJoin();
    this.setIdleAnimation();
    this.state = "playing";
    this.updateBridges();
  }

  setIdleAnimation() {
    if (this.isSplit) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_CUBE);
      this.blockPlayer.basePosition = blockTileToScreenPos(this.blockPos);
      if (this.block2Player) {
        this.block2Player.setAnimation(ANIM.BLOCK_CUBE);
        this.block2Player.basePosition = blockTileToScreenPos(this.block2Pos);
      }
      return;
    }

    if (this.blockOrientation === ORIENTATION.UP) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_UP);
    } else if (this.blockOrientation === ORIENTATION.RIGHT) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT);
    } else {
      this.blockPlayer.setAnimation(ANIM.BLOCK_FORWARD);
    }
    this.blockPlayer.basePosition = blockTileToScreenPos(this.blockPos);
  }

  getFootprintTiles() {
    const level = this.getLevel();
    let pos2 = clonePoint(this.blockPos);

    if (this.isSplit) {
      pos2 = clonePoint(this.block2Pos);
    } else if (this.blockOrientation === ORIENTATION.FORWARD) {
      pos2.y += 1;
    } else if (this.blockOrientation === ORIENTATION.RIGHT) {
      pos2.x += 1;
    }

    const tileIndex1 = tileToIndex(this.blockPos.x, this.blockPos.y);
    const tileIndex2 = tileToIndex(pos2.x, pos2.y);
    const tile1 = level.tiles[tileIndex1] ?? TILE.EMPTY;
    const tile2 = level.tiles[tileIndex2] ?? TILE.EMPTY;

    return { tile1, tile2, tileIndex1, tileIndex2, pos2 };
  }

  isValidPosition(tile1, tile2, tileIndex1, tileIndex2) {
    const checkTile2 = this.isSplit || this.blockOrientation !== ORIENTATION.UP;

    if (tile1 === TILE.EMPTY || (checkTile2 && tile2 === TILE.EMPTY)) return false;

    if (tile1 === TILE.BRIDGE_LEFT || tile1 === TILE.BRIDGE_RIGHT) {
      if (!this.getBridgeState(tileIndex1)) return false;
    }
    if (checkTile2 && (tile2 === TILE.BRIDGE_LEFT || tile2 === TILE.BRIDGE_RIGHT)) {
      if (!this.getBridgeState(tileIndex2)) return false;
    }

    if (!this.isSplit && this.blockOrientation === ORIENTATION.UP && tile1 === TILE.RED) {
      return false;
    }

    return true;
  }

  getBridgeState(tileIndex) {
    const b = this.bridges.find((br) => br.index === tileIndex);
    return b ? b.state : false;
  }

  switchPressed(tileIndex) {
    const level = this.getLevel();
    let bridgeEnabled = false;
    let bridgeDisabled = false;

    this.audio.play("hover");

    for (const config of level.switches) {
      if (config.switchTileIndex !== tileIndex) continue;

      const b = this.bridges.find((br) => br.index === config.bridgeTileIndex);
      if (!b) continue;

      if (config.mode === SWITCH.ON_OFF) {
        b.state = !b.state;
        if (b.state) bridgeEnabled = true;
        else bridgeDisabled = true;
      } else if (config.mode === SWITCH.ON) {
        if (!b.state) {
          b.state = true;
          bridgeEnabled = true;
        }
      } else if (config.mode === SWITCH.OFF) {
        if (b.state) {
          b.state = false;
          bridgeDisabled = true;
        }
      }
      b.highlightTimer = BRIDGE_HIGHLIGHT_FRAMES;
    }

    if (bridgeEnabled) this.audio.play("bridge_enabled");
    if (bridgeDisabled) this.audio.play("bridge_disabled");
  }

  doSplit(tileIndex) {
    const level = this.getLevel();
    const config = level.splits.find((s) => s.splitTileIndex === tileIndex);
    if (!config) return;

    this.isSplit = true;
    this.activeSplit = false;
    this.blockPos.x = config.tile1Index % 15;
    this.blockPos.y = Math.floor(config.tile1Index / 15);
    this.block2Pos.x = config.tile2Index % 15;
    this.block2Pos.y = Math.floor(config.tile2Index / 15);

    this.blockPlayer.setAnimation(ANIM.BLOCK_CUBE);
    this.block2Player = new AnimationPlayer();
    this.block2Player.setAnimation(ANIM.BLOCK_CUBE);
    this.blockPlayer.basePosition = blockTileToScreenPos(this.blockPos);
    this.block2Player.basePosition = blockTileToScreenPos(this.block2Pos);

    this.audio.play("whoosh");
    this.activeSplitHighlightTimer = 0;
    this.setIdleAnimation();
    this.state = "playing";
  }

  tryJoin() {
    if (!this.isSplit) return;

    const xNeighbors = this.blockPos.y === this.block2Pos.y && Math.abs(this.blockPos.x - this.block2Pos.x) <= 1;
    const yNeighbors = this.blockPos.x === this.block2Pos.x && Math.abs(this.blockPos.y - this.block2Pos.y) <= 1;

    if (!xNeighbors && !yNeighbors) return;

    this.isSplit = false;
    this.activeSplit = false;
    this.block2Player = null;

    if (xNeighbors) {
      this.blockOrientation = ORIENTATION.RIGHT;
      this.blockPos.x = Math.min(this.blockPos.x, this.block2Pos.x);
    } else {
      this.blockOrientation = ORIENTATION.FORWARD;
      this.blockPos.y = Math.min(this.blockPos.y, this.block2Pos.y);
    }

    this.blockPlayer.setAnimation(
      this.blockOrientation === ORIENTATION.RIGHT ? ANIM.BLOCK_RIGHT : ANIM.BLOCK_FORWARD
    );
    this.blockPlayer.basePosition = blockTileToScreenPos(this.blockPos);
    this.audio.play("click");
  }

  updateBridges() {
    for (const b of this.bridges) {
      if (b.frame < 7 && b.state) b.frame++;
      else if (b.frame > 0 && !b.state) b.frame--;
      if (b.highlightTimer > 0) b.highlightTimer--;
    }
  }

  updatePause() {
    if (this.keys["ArrowUp"]) {
      this.pauseOption = 0;
      this.keys["ArrowUp"] = false;
      this.audio.play("hover");
    } else if (this.keys["ArrowDown"]) {
      this.pauseOption = 1;
      this.keys["ArrowDown"] = false;
      this.audio.play("hover");
    } else if (this.keys["Escape"] || this.keys["Space"]) {
      this.keys["Escape"] = false;
      this.keys["Space"] = false;
      this.paused = false;
      this.audio.play("click");
      if (this.pauseOption === 1) return "menu";
    }
    return null;
  }

  draw() {
    this.renderer.clear();
    this.renderer.beginFrame();

    if (this.state === "congrats") {
      this.renderer.drawCongrats({
        moves: this.movesCount,
        time: formatTime(Date.now() - this.timerStart),
        failed: this.failedCount,
      });
      this.renderer.endFrame();
      return;
    }

    const level = this.getLevel();
    this.renderer.drawGradientBg();
    this.renderer.drawLevelBg(level.number);
    this.renderer.drawBridges(this.bridges);

    if (this.blockVisible && this.state !== "title") {
      this.renderer.drawBlock(this.blockPlayer, this.blockAlpha);
      if (this.isSplit && this.block2Player) {
        this.renderer.drawBlock(this.block2Player);
        const activePos = this.activeSplit ? this.block2Pos : this.blockPos;
        this.renderer.drawSplitBrackets(activePos, this.activeSplitHighlightTimer);
        if (this.activeSplitHighlightTimer < SPLIT_HIGHLIGHT_FRAMES) {
          this.activeSplitHighlightTimer++;
        }
      }
    }

    if (this.state === "title") {
      const alpha = this.titleTimer > TITLE_FRAMES - 30
        ? (TITLE_FRAMES - this.titleTimer) / 30
        : this.titleTimer < 30
          ? this.titleTimer / 30
          : 1;
      this.renderer.drawTitleCard(level.number, alpha);
    }

    this.renderer.drawHud(level.code, this.movesCount);

    if (this.paused) {
      this.renderer.drawPauseMenu(this.pauseOption, {
        time: formatTime(Date.now() - this.timerStart),
        stage: String(level.number).padStart(2, "0"),
        attempts: this.attemptsCount,
      });
    }

    this.renderer.endFrame();
  }

  getStats() {
    return {
      moves: this.movesCount,
      time: formatTime(Date.now() - this.timerStart),
      failed: this.failedCount,
    };
  }
}
