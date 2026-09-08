import {
  CANVAS_W,
  CANVAS_H,
  GBA_W,
  GBA_H,
  SCALE,
  TILE,
  SPLIT_HIGHLIGHT_FRAMES,
} from "./constants.js";
import { blockTileToScreenPos, bridgeTileToScreenPos, padNumber } from "./helpers.js";
import { drawSpriteFrame, drawBg, drawDigit } from "./assets.js";

export class Renderer {
  constructor(ctx, sprites) {
    this.ctx = ctx;
    this.sprites = sprites;
    this.mosaic = 0;
  }

  clear() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  beginFrame() {
    this.ctx.save();
    this.ctx.scale(SCALE, SCALE);
    this.ctx.translate(GBA_W / 2, GBA_H / 2);
    if (this.mosaic > 0) {
      this.ctx.filter = `blur(${this.mosaic}px)`;
    }
  }

  endFrame() {
    this.ctx.restore();
  }

  setMosaic(v) {
    this.mosaic = v;
  }

  drawGradientBg() {
    drawBg(this.ctx, this.sprites.level_gradient_bg, -120 + 8, -80 + 48);
  }

  drawLevelBg(levelNumber) {
    const img = this.sprites[`level_${levelNumber}`];
    if (img) drawBg(this.ctx, img, -128, -128);
  }

  drawMenuBg() {
    drawBg(this.ctx, this.sprites.bg1, -120, -80 + 48);
  }

  drawLogo(x, y, alpha = 1) {
    drawBg(this.ctx, this.sprites.text, x - 44, y - 24, alpha);
  }

  drawPauseBg() {
    drawBg(this.ctx, this.sprites.pause_menu_bg, -120, -80);
  }

  drawSplash() {
    drawBg(this.ctx, this.sprites.nostabyte, -120, -80 + 48);
  }

  drawTutorial(page) {
    const img = this.sprites[`tutorial_bg_${page + 1}`];
    if (img) drawBg(this.ctx, img, -128, -128);
  }

  drawBridges(bridges) {
    for (const b of bridges) {
      let frame = b.frame;
      if (b.type) frame += 8;
      const tile = { x: b.index % 15, y: Math.floor(b.index / 15) };
      const pos = bridgeTileToScreenPos(tile);
      const sx = pos.x + (b.type ? 6 : -5);
      const sy = pos.y;
      drawSpriteFrame(this.ctx, this.sprites.bridge, frame, sx, sy);

      if (b.highlightTimer > 0) {
        const hx = pos.x + 3;
        const hy = pos.y - 3;
        drawSpriteFrame(this.ctx, this.sprites.highlight, b.state ? 1 : 0, hx, hy);
      }
    }
  }

  drawBlock(player, alpha = 1) {
    const pos = player.getDrawPosition();
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    drawSpriteFrame(this.ctx, this.sprites.block, player.getSpriteFrame(), pos.x, pos.y);
    this.ctx.restore();
  }

  drawSplitBrackets(activePos, timer) {
    if (timer >= SPLIT_HIGHLIGHT_FRAMES) return;
    const dist = Math.max(SPLIT_HIGHLIGHT_FRAMES / 2 - timer, 0) + 12;
    const screen = blockTileToScreenPos(activePos);
    const ax = screen.x + 24 - dist;
    const ay = screen.y + 21;
    drawSpriteFrame(this.ctx, this.sprites.bracket, 0, ax, ay);
    drawSpriteFrame(this.ctx, this.sprites.bracket, 0, ax + dist * 2, ay, true);
  }

  drawHud(code, moves) {
    this.ctx.save();
    this.ctx.font = "8px monospace";
    this.ctx.fillStyle = "#fff";
    this.ctx.textAlign = "right";
    this.ctx.fillText(`CODE ${padNumber(code, 6, "0")}`, 118, -74 + 80);
    this.ctx.fillText(`MOVES ${padNumber(moves, 6, " ")}`, 118, -66 + 80);
    this.ctx.restore();
  }

  drawTitleCard(levelNumber, alpha) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    drawBg(this.ctx, this.sprites.text, 128 - 44 - 120, -24);
    const d1 = Math.floor(levelNumber / 10) % 10;
    const d2 = levelNumber % 10;
    drawDigit(this.ctx, this.sprites.numbers, d1, 21 - 120, 0);
    drawDigit(this.ctx, this.sprites.numbers, d2, 33 - 120, 0);
    this.ctx.restore();
  }

  drawMenuText(lines, selectedIndex, yOffset = 0) {
    this.ctx.save();
    this.ctx.font = "8px monospace";
    this.ctx.fillStyle = "#fff";
    this.ctx.textAlign = "left";
    lines.forEach((line, i) => {
      const prefix = i === selectedIndex ? "> " : "  ";
      this.ctx.fillText(prefix + line, -68, 10 + i * 10 + yOffset + 80);
    });
    this.ctx.textAlign = "right";
    this.ctx.fillText("v1.0", 118, 74 + 80);
    this.ctx.restore();
  }

  drawPasscode(code, selectedDigit, invalidTimer) {
    this.ctx.save();
    this.ctx.font = "8px monospace";
    this.ctx.fillStyle = "#fff";
    this.ctx.textAlign = "center";
    this.ctx.fillText(padNumber(code, 6, "0"), 0, 28 + 80);
    this.ctx.fillText("^", selectedDigit * 7 - 18, 9 + 28 + 80);
    if (invalidTimer > 0) {
      this.ctx.fillText("INVALID CODE", 0, 23 + 28 + 80);
    }
    this.ctx.restore();
  }

  drawCredits(lines, yOffset = 0) {
    this.ctx.save();
    this.ctx.font = "8px monospace";
    this.ctx.fillStyle = "#fff";
    lines.forEach((line, i) => {
      if (i === 0) {
        this.ctx.textAlign = "left";
        this.ctx.fillText(line, -68, 8 + yOffset + 80);
      } else {
        this.ctx.textAlign = "center";
        const offset = i % 2 ? 2 : 0;
        this.ctx.fillText(line, 0, 16 + i * 11 + yOffset + offset + 80);
      }
    });
    this.ctx.restore();
  }

  drawPauseMenu(option, stats) {
    this.drawPauseBg();
    this.ctx.save();
    this.ctx.font = "8px monospace";
    this.ctx.fillStyle = "#fff";
    this.ctx.textAlign = "left";
    this.ctx.fillText((option === 0 ? "> " : "  ") + "Return to Game", -108, 30 + 80);
    this.ctx.fillText((option === 1 ? "> " : "  ") + "Quit to Menu", -108, 40 + 80);
    this.ctx.textAlign = "left";
    this.ctx.fillText("Time", 16, 30 + 80);
    this.ctx.fillText("Stage", 16, 40 + 80);
    this.ctx.fillText("Attempts", 16, 50 + 80);
    this.ctx.textAlign = "right";
    this.ctx.fillText(stats.time, 102, 30 + 80);
    this.ctx.fillText(stats.stage, 102, 40 + 80);
    this.ctx.fillText(String(stats.attempts), 102, 50 + 80);
    this.ctx.restore();
  }

  drawCongrats(stats) {
    this.drawMenuBg();
    this.drawLogo(23, -12, 1);
    this.ctx.save();
    this.ctx.font = "8px monospace";
    this.ctx.fillStyle = "#fff";
    this.ctx.textAlign = "center";
    this.ctx.fillText("You completed the 33 stages of Bloxorz!", 0, -1 + 80);
    this.ctx.textAlign = "right";
    this.ctx.fillText("Moves Taken:", -8, 18 + 80);
    this.ctx.fillText("Time Taken:", -8, 27 + 80);
    this.ctx.fillText("Failed Attempts:", -8, 36 + 80);
    this.ctx.textAlign = "right";
    this.ctx.fillText(String(stats.moves), 50, 18 + 80);
    this.ctx.fillText(stats.time, 50, 27 + 80);
    this.ctx.fillText(String(stats.failed), 50, 36 + 80);
    this.ctx.textAlign = "center";
    this.ctx.fillText("Press Space or Esc to return to menu", 0, 60 + 80);
    this.ctx.restore();
  }

  drawTutorialText(text, page, total) {
    this.ctx.save();
    this.ctx.font = "8px monospace";
    this.ctx.fillStyle = "#fff";
    this.ctx.textAlign = "center";
    this.wrapText(text, 0, 60 + 80, 200, 10);
    this.ctx.fillText(`${page + 1} / ${total}  —  Space: next`, 0, 72 + 80);
    this.ctx.restore();
  }

  wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let cy = y;
    for (const word of words) {
      const test = line + word + " ";
      if (this.ctx.measureText(test).width > maxWidth && line) {
        this.ctx.fillText(line.trim(), x, cy);
        line = word + " ";
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    this.ctx.fillText(line.trim(), x, cy);
  }
}
