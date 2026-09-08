import { SCENE } from "./constants.js";
import { MenuScene } from "./menuScene.js";
import { LevelScene } from "./levelScene.js";

export class Game {
  constructor(canvas, sprites, audioBuffers) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    import("./renderer.js").then(({ Renderer }) => {
      this.renderer = new Renderer(this.ctx, sprites);
    });

    import("./audio.js").then(({ AudioManager }) => {
      this.audio = new AudioManager(audioBuffers);
    });

    this.sprites = sprites;
    this.audioBuffers = audioBuffers;
    this.levels = [];
    this.scene = null;
    this.sceneName = SCENE.SPLASH;
    this.pendingStartLevel = 0;
    this.ready = false;
  }

  async init(levels) {
    const { Renderer } = await import("./renderer.js");
    const { AudioManager } = await import("./audio.js");
    this.renderer = new Renderer(this.ctx, this.sprites);
    this.audio = new AudioManager(this.audioBuffers);
    this.levels = levels;
    this.menuScene = new MenuScene(levels, this.audio, this.renderer);
    this.scene = this.menuScene;
    this.ready = true;
  }

  handleKeyDown(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Escape", "Enter"].includes(e.code)) {
      e.preventDefault();
    }
    this.scene?.handleKeyDown(e.code);
  }

  handleKeyUp(e) {
    this.scene?.handleKeyUp(e.code);
  }

  update() {
    if (!this.ready) return;

    const result = this.scene.update();

    if (result === "level") {
      const startLevel = this.scene.startLevel ?? 0;
      this.levelScene = new LevelScene(this.levels, this.audio, this.renderer, {});
      this.levelScene.start(startLevel);
      this.scene = this.levelScene;
    } else if (result === "menu") {
      this.audio.stopMusic();
      this.menuScene = new MenuScene(this.levels, this.audio, this.renderer);
      this.menuScene.state = "menu";
      this.menuScene.audio.playMusic("menu");
      this.scene = this.menuScene;
    }
  }

  draw() {
    if (!this.ready) {
      this.ctx.fillStyle = "#000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "16px monospace";
      this.ctx.textAlign = "center";
      this.ctx.fillText("Loading...", this.canvas.width / 2, this.canvas.height / 2);
      return;
    }
    this.scene.draw();
  }

  tick() {
    this.update();
    this.draw();
  }
}
