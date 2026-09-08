import { BLOCK_ANIMATIONS } from "./constants.js";

export class AnimationPlayer {
  constructor() {
    this.animIndex = 0;
    this.frame = 0;
    this.frameTime = 1;
    this.frameCounter = 0;
    this.playing = false;
    this.done = true;
    this.position = { x: 0, y: 0 };
    this.basePosition = { x: 0, y: 0 };
  }

  setAnimation(index) {
    this.animIndex = index;
    this.frame = 0;
    this.frameCounter = 0;
    this.playing = false;
    this.done = true;
  }

  playUntilDone() {
    this.frame = 0;
    this.frameCounter = 0;
    this.playing = true;
    this.done = false;
  }

  update() {
    if (!this.playing) return false;

    this.frameCounter++;
    if (this.frameCounter >= this.frameTime) {
      this.frameCounter = 0;
      const anim = BLOCK_ANIMATIONS[this.animIndex];
      this.frame++;

      if (this.frame >= anim.frames.length) {
        if (anim.loop) {
          this.frame = 0;
        } else {
          this.frame = anim.frames.length - 1;
          this.playing = false;
          this.done = true;
          return true;
        }
      }
    }
    return false;
  }

  getDrawPosition() {
    const anim = BLOCK_ANIMATIONS[this.animIndex];
    const offset = anim.offsets[this.frame] ?? anim.offsets[0];
    return {
      x: this.basePosition.x - offset[0],
      y: this.basePosition.y - offset[1],
    };
  }

  getSpriteFrame() {
    const anim = BLOCK_ANIMATIONS[this.animIndex];
    return anim.frames[this.frame] ?? anim.frames[0];
  }
}
