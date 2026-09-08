import { INVALID_CODE_FRAMES } from "./constants.js";
import { blockTileToScreenPos } from "./helpers.js";
import { AnimationPlayer } from "./animation.js";
import { ANIM } from "./constants.js";

const MENU_ITEMS = ["Start New Game", "Load Stage", "Credits"];

export class MenuScene {
  constructor(levels, audio, renderer) {
    this.levels = levels;
    this.audio = audio;
    this.renderer = renderer;

    this.screen = "main";
    this.selectedItem = 0;
    this.enteredCode = 0;
    this.selectedDigit = 0;
    this.invalidCodeTimer = 0;
    this.logoYOffset = 0;
    this.frame = 0;
    this.logoFrame = 0;
    this.bgAlpha = 0.25;
    this.showCursor = false;

    this.blockPos = { x: 17, y: 7 };
    this.blockPlayer = new AnimationPlayer();
    this.blockPlayer.setAnimation(ANIM.BLOCK_UP);
    this.blockPlayer.frameTime = 2;

    this.splashTimer = 90;
    this.state = "splash";

    this.keys = {};
    this.startLevel = 0;
  }

  handleKeyDown(code) {
    this.keys[code] = true;
  }

  handleKeyUp(code) {
    this.keys[code] = false;
  }

  update() {
    if (this.state === "splash") {
      this.splashTimer--;
      if (this.splashTimer <= 0 || this.keys["Space"] || this.keys["Enter"]) {
        this.state = "menu";
        this.audio.playMusic("menu");
        this.keys["Space"] = false;
        this.keys["Enter"] = false;
      }
      return null;
    }

    this.frame++;
    this.logoFrame = Math.min(4, Math.floor(this.frame / 15));

    const pulse = this.frame % 300;
    this.bgAlpha = pulse >= 150
      ? 0.25 + ((pulse - 150) / 150) * 0.75
      : 0.25 + (1 - pulse / 150) * 0.75;

    this.updateBlockAnimation();

    if (this.invalidCodeTimer > 0) this.invalidCodeTimer--;

    if (this.screen === "main") return this.updateMainMenu();
    if (this.screen === "load") return this.updateLoadStage();
    if (this.screen === "credits") return this.updateCredits();
    return null;
  }

  updateMainMenu() {
    if (this.keys["ArrowUp"]) {
      this.selectedItem = (this.selectedItem + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
      this.keys["ArrowUp"] = false;
      this.audio.play("hover");
    } else if (this.keys["ArrowDown"]) {
      this.selectedItem = (this.selectedItem + 1) % MENU_ITEMS.length;
      this.keys["ArrowDown"] = false;
      this.audio.play("hover");
    } else if (this.keys["Enter"] || this.keys["Space"]) {
      this.keys["Enter"] = false;
      this.keys["Space"] = false;
      this.audio.play("click");

      if (this.selectedItem === 0) {
        this.startLevel = 0;
        return "level";
      }
      if (this.selectedItem === 1) {
        this.screen = "load";
        this.enteredCode = 0;
        this.selectedDigit = 0;
        this.logoYOffset = -12;
        this.showCursor = false;
        return null;
      }
      if (this.selectedItem === 2) {
        this.screen = "credits";
        this.logoYOffset = -24;
        this.showCursor = false;
        return null;
      }
    }
    return null;
  }

  updateLoadStage() {
    if (this.keys["ArrowLeft"]) {
      this.selectedDigit = Math.max(0, this.selectedDigit - 1);
      this.keys["ArrowLeft"] = false;
      this.audio.play("hover");
    } else if (this.keys["ArrowRight"]) {
      this.selectedDigit = Math.min(5, this.selectedDigit + 1);
      this.keys["ArrowRight"] = false;
      this.audio.play("hover");
    } else if (this.keys["ArrowUp"]) {
      const digit = Math.floor(this.enteredCode / 10 ** (5 - this.selectedDigit)) % 10;
      this.enteredCode = this.setDigit(this.enteredCode, this.selectedDigit, (digit + 1) % 10);
      this.keys["ArrowUp"] = false;
      this.audio.play("hover");
    } else if (this.keys["ArrowDown"]) {
      const digit = Math.floor(this.enteredCode / 10 ** (5 - this.selectedDigit)) % 10;
      this.enteredCode = this.setDigit(this.enteredCode, this.selectedDigit, (digit + 9) % 10);
      this.keys["ArrowDown"] = false;
      this.audio.play("hover");
    } else if (this.keys["Enter"] || this.keys["Space"]) {
      this.keys["Enter"] = false;
      this.keys["Space"] = false;
      const level = this.levels.find((l) => l.code === this.enteredCode);
      if (level) {
        this.audio.play("click");
        this.startLevel = level.number - 1;
        return "level";
      }
      this.invalidCodeTimer = INVALID_CODE_FRAMES;
      this.audio.play("fail");
    } else if (this.keys["Escape"]) {
      this.keys["Escape"] = false;
      this.screen = "main";
      this.logoYOffset = 0;
      this.showCursor = true;
      this.audio.play("click");
    }
    return null;
  }

  setDigit(num, pos, digit) {
    const factor = 10 ** (5 - pos);
    const before = Math.floor(num / (factor * 10));
    const after = num % factor;
    return before * factor * 10 + digit * factor + after;
  }

  updateCredits() {
    if (this.keys["Escape"] || this.keys["Enter"] || this.keys["Space"]) {
      this.keys["Escape"] = false;
      this.keys["Enter"] = false;
      this.keys["Space"] = false;
      this.screen = "main";
      this.logoYOffset = 0;
      this.showCursor = true;
      this.audio.play("click");
    }
    return null;
  }

  updateBlockAnimation() {
    const moveFrames = this.blockPlayer.frameTime * 8;

    if (this.frame === 0) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_UP_MOVE_LEFT);
    } else if (this.frame === moveFrames - 1) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT);
      this.blockPos.x -= 2;
    } else if (this.frame === moveFrames) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT_MOVE_FORWARD);
    } else if (this.frame === moveFrames * 2 - 1) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT);
      this.blockPos.y -= 1;
    } else if (this.frame === moveFrames * 2) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT_MOVE_LEFT);
    } else if (this.frame === moveFrames * 3 - 1) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_UP);
      this.blockPos.x -= 1;
    } else if (this.frame === moveFrames * 3) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_UP_MOVE_LEFT);
    } else if (this.frame === moveFrames * 4 - 1) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT);
      this.blockPos.x -= 2;
    } else if (this.frame === moveFrames * 4) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT_MOVE_FORWARD);
    } else if (this.frame === moveFrames * 5 - 1) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT);
      this.blockPos.y -= 1;
    } else if (this.frame === moveFrames * 5) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT_MOVE_LEFT);
    } else if (this.frame === moveFrames * 6 - 1) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_UP);
      this.blockPos.x -= 1;
      this.showCursor = true;
    } else if (this.frame === moveFrames * 6 + 3) {
      this.blockPlayer.setAnimation(ANIM.BLOCK_SPIN_BACK);
    }

    this.blockPlayer.update();

    const screen = blockTileToScreenPos(this.blockPos);
    this.blockPlayer.basePosition = {
      x: screen.x + 6,
      y: screen.y + 6 + this.logoYOffset,
    };
  }

  draw() {
    this.renderer.clear();
    this.renderer.beginFrame();

    if (this.state === "splash") {
      this.renderer.drawSplash();
      this.renderer.endFrame();
      return;
    }

    this.renderer.drawMenuBg(this.bgAlpha);
    this.renderer.drawAnimatedLogo(
      this.logoFrame,
      58,
      80 + 10 - this.logoFrame * 20 + this.logoYOffset
    );
    this.renderer.drawBlock(this.blockPlayer);

    if (this.screen === "main") {
      this.renderer.drawMenuText(MENU_ITEMS, this.selectedItem, this.logoYOffset, this.showCursor);
    } else if (this.screen === "load") {
      this.renderer.drawPasscode(this.enteredCode, this.selectedDigit, this.invalidCodeTimer);
    } else if (this.screen === "credits") {
      this.renderer.drawCredits([
        "Credits",
        "Original game by Damien Clarke,",
        "DX Interactive, 2007.",
        "GBA port by Jacob Coughenour.",
        "HTML remake, 2026.",
      ], this.logoYOffset);
    }

    this.renderer.endFrame();
  }
}
