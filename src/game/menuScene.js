import { INVALID_CODE_FRAMES, TUTORIAL_PAGES } from "./constants.js";
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

    this.blockPos = { x: 8, y: 4 };
    this.blockPlayer = new AnimationPlayer();
    this.blockPlayer.setAnimation(ANIM.BLOCK_UP);
    this.blockPlayer.frameTime = 2;

    this.splashTimer = 120;
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

    if (this.state === "tutorial") {
      return this.updateTutorial();
    }

    this.updateBlockAnimation();

    if (this.invalidCodeTimer > 0) this.invalidCodeTimer--;

    if (this.screen === "main") {
      return this.updateMainMenu();
    }
    if (this.screen === "load") {
      return this.updateLoadStage();
    }
    if (this.screen === "credits") {
      return this.updateCredits();
    }

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
        this.state = "tutorial";
        this.tutorialPage = 0;
        return null;
      }
      if (this.selectedItem === 1) {
        this.screen = "load";
        this.enteredCode = 0;
        this.selectedDigit = 0;
        return null;
      }
      if (this.selectedItem === 2) {
        this.screen = "credits";
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
      const digit = Math.floor(this.enteredCode / Math.pow(10, 5 - this.selectedDigit)) % 10;
      const newDigit = (digit + 1) % 10;
      this.enteredCode = this.setDigit(this.enteredCode, this.selectedDigit, newDigit);
      this.keys["ArrowUp"] = false;
      this.audio.play("hover");
    } else if (this.keys["ArrowDown"]) {
      const digit = Math.floor(this.enteredCode / Math.pow(10, 5 - this.selectedDigit)) % 10;
      const newDigit = (digit + 9) % 10;
      this.enteredCode = this.setDigit(this.enteredCode, this.selectedDigit, newDigit);
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
      this.audio.play("click");
    }
    return null;
  }

  setDigit(num, pos, digit) {
    const factor = Math.pow(10, 5 - pos);
    const before = Math.floor(num / (factor * 10));
    const after = num % Math.pow(10, 5 - pos);
    return before * factor * 10 + digit * factor + after;
  }

  updateCredits() {
    if (this.keys["Escape"] || this.keys["Enter"] || this.keys["Space"]) {
      this.keys["Escape"] = false;
      this.keys["Enter"] = false;
      this.keys["Space"] = false;
      this.screen = "main";
      this.audio.play("click");
    }
    return null;
  }

  updateTutorial() {
    if (this.keys["Space"] || this.keys["Enter"] || this.keys["ArrowRight"]) {
      this.keys["Space"] = false;
      this.keys["Enter"] = false;
      this.keys["ArrowRight"] = false;
      this.tutorialPage++;
      this.audio.play("click");
      if (this.tutorialPage >= TUTORIAL_PAGES.length) {
        this.startLevel = 0;
        return "level";
      }
    } else if (this.keys["ArrowLeft"] && this.tutorialPage > 0) {
      this.tutorialPage--;
      this.keys["ArrowLeft"] = false;
      this.audio.play("hover");
    } else if (this.keys["Escape"]) {
      this.state = "menu";
      this.keys["Escape"] = false;
    }
    return null;
  }

  updateBlockAnimation() {
    const moveFrames = this.blockPlayer.frameTime * 9;
    this.frame++;

    const seq = [
      [ANIM.BLOCK_UP_MOVE_LEFT, null],
      [null, { x: -2, y: 0 }],
      [ANIM.BLOCK_RIGHT_MOVE_FORWARD, null],
      [null, { x: 0, y: -1 }],
      [ANIM.BLOCK_RIGHT_MOVE_LEFT, null],
      [null, { x: -1, y: 0 }],
    ];

    const cycleLen = moveFrames * seq.length;
    const phase = this.frame % cycleLen;
    const step = Math.floor(phase / moveFrames);
    const sub = phase % moveFrames;

    if (sub === 0 && seq[step][0]) {
      this.blockPlayer.setAnimation(seq[step][0]);
      this.blockPlayer.playUntilDone();
    }
    if (sub === moveFrames - 1 && seq[step][1]) {
      this.blockPos.x += seq[step][1].x;
      this.blockPos.y += seq[step][1].y;
      if (step === 1) this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT);
      if (step === 3) this.blockPlayer.setAnimation(ANIM.BLOCK_RIGHT);
      if (step === 5) this.blockPlayer.setAnimation(ANIM.BLOCK_UP);
    }

    this.blockPlayer.update();
    this.blockPlayer.basePosition = blockTileToScreenPos(this.blockPos);
  }

  draw() {
    this.renderer.clear();
    this.renderer.beginFrame();

    if (this.state === "splash") {
      this.renderer.drawSplash();
      this.renderer.endFrame();
      return;
    }

    if (this.state === "tutorial") {
      this.renderer.drawTutorial(this.tutorialPage);
      this.renderer.drawTutorialText(
        TUTORIAL_PAGES[this.tutorialPage],
        this.tutorialPage,
        TUTORIAL_PAGES.length
      );
      this.renderer.endFrame();
      return;
    }

    this.renderer.drawMenuBg();
    this.renderer.drawLogo(60, 96 - 80, 1);
    this.renderer.drawBlock(this.blockPlayer);

    if (this.screen === "main") {
      this.renderer.drawMenuText(MENU_ITEMS, this.selectedItem, this.logoYOffset);
    } else if (this.screen === "load") {
      this.renderer.drawPasscode(this.enteredCode, this.selectedDigit, this.invalidCodeTimer);
    } else if (this.screen === "credits") {
      this.renderer.drawCredits([
        "Credits",
        "Original game created by Damien Clarke,",
        "DX Interactive, 21st June 2007.",
        "HTML remake based on GBA port by",
        "Jacob Coughenour, Nostabyte Interactive.",
      ], this.logoYOffset);
    }

    this.renderer.endFrame();
  }
}
