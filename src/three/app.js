import { DIR, ROLL_MS } from "../game/constants.js";
import { clonePos } from "../game/helpers.js";
import { GameState } from "../game/gameState.js";
import { createWorld } from "./world.js";
import { BoardView, BlockView, LEVEL_OFFSET_X, LEVEL_OFFSET_Z } from "./board.js";
import { UI } from "./ui.js";

export class BloxorzApp {
  constructor(canvas, overlay, levels) {
    this.world = createWorld(canvas);
    this.board = new BoardView(this.world.scene);
    this.block = new BlockView(this.world.scene);
    this.ui = new UI(overlay);
    this.game = new GameState(levels);
    this.busy = false;
    this.paused = false;

    this.ui.onPlay = () => this.startGame(0);
    this.ui.onLoad = (code) => {
      const idx = this.game.findLevelByCode(parseInt(code, 10) || 0);
      if (idx < 0) {
        this.ui.flashLoadError();
        return;
      }
      this.startGame(idx);
    };
    this.ui.onMenu = () => {
      this.game.phase = "menu";
      this.ui.showMenu();
    };

    window.addEventListener("keydown", (e) => this.onKey(e));
    this.ui.showMenu();
    this.loop();
  }

  snapshot() {
    const g = this.game;
    return {
      pos: clonePos(g.pos),
      pos2: clonePos(g.pos2),
      orientation: g.orientation,
      isSplit: g.isSplit,
      activeSplit: g.activeSplit,
    };
  }

  async startGame(index) {
    this.game.moves = 0;
    this.game.fails = 0;
    this.game.attempts = 0;
    this.game.startTime = Date.now();
    this.game.loadLevel(index, true);
    this.ui.showGame();
    await this.showTitleCard();
    this.board.build(this.game.level);
    this.block.sync(this.game);
    this.game.phase = "playing";
  }

  async showTitleCard() {
    this.ui.showTitle(this.game.level.number);
    await delay(900);
    this.ui.hideTitle();
  }

  async onKey(e) {
    if (this.game.phase === "menu" || this.game.phase === "complete") return;
    if (this.busy) return;

    if (e.code === "Escape") {
      this.paused = !this.paused;
      return;
    }
    if (this.paused) return;

    if (e.code === "Space" && this.game.isSplit) {
      e.preventDefault();
      this.game.toggleSplitControl();
      this.block.sync(this.game);
      return;
    }

    let dir = null;
    if (e.code === "ArrowUp") dir = DIR.FORWARD;
    else if (e.code === "ArrowDown") dir = DIR.BACK;
    else if (e.code === "ArrowLeft") dir = DIR.LEFT;
    else if (e.code === "ArrowRight") dir = DIR.RIGHT;
    if (dir === null) return;

    e.preventDefault();
    await this.tryMove(dir);
  }

  async tryMove(dir) {
    if (this.game.phase !== "playing") return;

    const prev = this.snapshot();
    const g = this.game;

    if (g.isSplit) g.applySplitMove(dir);
    else g.applyMove(dir);

    g.moves++;
    this.busy = true;

    const next = this.snapshot();
    await this.block.roll(prev, next, ROLL_MS);

    if (!g.isValidLanding()) {
      await this.block.fall();
      g.fails++;
      g.attempts++;
      g.loadLevel(g.levelIndex, false);
      this.board.build(g.level);
      this.block.sync(g);
      this.busy = false;
      return;
    }

    g.triggerSwitches();
    this.board.syncBridges(g.bridges);

    if (g.trySplit()) {
      this.block.sync(g);
    } else {
      g.tryJoin();
      this.block.sync(g);
    }

    if (g.isWin()) {
      await this.block.sink();
      const nextIdx = g.levelIndex + 1;
      if (nextIdx >= g.levels.length) {
        g.phase = "complete";
        this.ui.showComplete(g.moves, Date.now() - g.startTime, g.fails);
      } else {
        g.loadLevel(nextIdx, true);
        this.ui.showTitle(g.level.number);
        await delay(900);
        this.ui.hideTitle();
        this.board.build(g.level);
        this.block.sync(g);
        g.phase = "playing";
      }
      this.busy = false;
      return;
    }

    this.busy = false;
  }

  loop() {
    if (this.game.phase === "playing" || this.game.phase === "title") {
      this.ui.updateHud(this.game, Date.now() - this.game.startTime);
      this.board.syncBridges(this.game.bridges);
    }
    this.world.renderer.render(this.world.scene, this.world.camera);
    requestAnimationFrame(() => this.loop());
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
