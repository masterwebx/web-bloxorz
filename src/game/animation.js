import { BLOCK_ANIMATIONS } from "./constants.js";

export class AnimationPlayer {
  constructor() {
    this.animIndex = 0;
    this.t = 0;
    this.frameTime = 1;
    this.waitingDone = false;
    this.basePosition = { x: 0, y: 0 };
  }

  setAnimation(index) {
    this.animIndex = index;
    this.t = 0;
    this.waitingDone = false;
  }

  playUntilDone() {
    this.t = 0;
    this.waitingDone = true;
  }

  get anim() {
    return BLOCK_ANIMATIONS[this.animIndex];
  }

  get displayIndex() {
    const count = this.anim.frames.length;
    return Math.min(Math.floor(this.t / this.frameTime), count - 1);
  }

  isDone() {
    return this.displayIndex >= this.anim.frames.length - 1;
  }

  /** Advance one tick. Returns true once when a playUntilDone sequence finishes. */
  update() {
    const anim = this.anim;
    const idx = this.displayIndex;

    if (idx + 1 < anim.frames.length) {
      this.t++;
      return false;
    }

    if (anim.loop) {
      this.t = 0;
      return false;
    }

    if (this.waitingDone) {
      this.waitingDone = false;
      return true;
    }

    return false;
  }

  getDrawPosition() {
    const offset = this.anim.offsets[this.displayIndex] ?? this.anim.offsets[0];
    return {
      x: this.basePosition.x + offset[0],
      y: this.basePosition.y + offset[1],
    };
  }

  getSpriteFrame() {
    return this.anim.frames[this.displayIndex] ?? this.anim.frames[0];
  }
}
