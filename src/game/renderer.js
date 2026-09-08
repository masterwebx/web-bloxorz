import {
  CANVAS_W,
  CANVAS_H,
  GBA_W,
  GBA_H,
  SCALE,
  SPLIT_HIGHLIGHT_FRAMES,
} from "./constants.js";
import { blockTileToScreenPos, bridgeTileToScreenPos, padNumber } from "./helpers.js";
import { drawSpriteFrame, drawBgCentered, drawDigit } from "./assets.js";
import {
  PixelFont,
  CURSOR_GLYPH,
  drawLogoFrame,
  drawTextBanner,
  TEXT_STAGE_Y,
  TEXT_CONGRATS_Y,
} from "./font.js";

export class Renderer {
  constructor(ctx, sprites) {
    this.ctx = ctx;
    this.sprites = sprites;
    this.mosaic = 0;
    this.font = new PixelFont(sprites.font);
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
    drawBgCentered(this.ctx, this.sprites.level_gradient_bg, 8, 48);
  }

  drawLevelBg(levelNumber) {
    const img = this.sprites[`level_${levelNumber}`];
    if (img) drawBgCentered(this.ctx, img, 0, 0);
  }

  drawMenuBg(alpha = 1) {
    drawBgCentered(this.ctx, this.sprites.bg1, 0, 48, alpha);
  }

  drawAnimatedLogo(frame, x, y, alpha = 1) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    drawLogoFrame(this.ctx, this.sprites.text, frame, x, y);
    this.ctx.restore();
  }

  drawPauseBg() {
    drawBgCentered(this.ctx, this.sprites.pause_menu_bg, 0, 0);
  }

  drawSplash() {
    drawBgCentered(this.ctx, this.sprites.nostabyte, 0, 48);
  }

  drawTutorial(page) {
    const img = this.sprites[`tutorial_bg_${page + 1}`];
    if (img) drawBgCentered(this.ctx, img, 0, 0);
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
        drawSpriteFrame(
          this.ctx,
          this.sprites.highlight,
          b.state ? 1 : 0,
          pos.x + 3,
          pos.y - 3
        );
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
    this.font.drawText(this.ctx, `CODE ${padNumber(code, 6, "0")}`, 118, -74, "right");
    this.font.drawText(this.ctx, `MOVES ${padNumber(moves, 6, " ")}`, 118, -66, "right");
  }

  drawTitleCard(levelNumber, alpha) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    drawTextBanner(this.ctx, this.sprites.text, TEXT_STAGE_Y, 84, 0, 90, 18);
    const d1 = Math.floor(levelNumber / 10) % 10;
    const d2 = levelNumber % 10;
    drawDigit(this.ctx, this.sprites.numbers, d1, 21, -4);
    drawDigit(this.ctx, this.sprites.numbers, d2, 33, -4);
    this.ctx.restore();
  }

  drawMenuText(lines, selectedIndex, yOffset = 0, showCursor = true) {
    lines.forEach((line, i) => {
      const y = 10 + i * 10 + yOffset;
      if (showCursor && i === selectedIndex) {
        this.font.drawGlyph(this.ctx, CURSOR_GLYPH, -74, y - 6);
      }
      this.font.drawText(this.ctx, line, -68, y - 6);
    });
    this.font.drawText(this.ctx, "v1.0", 118, 74, "right");
  }

  drawPasscode(code, selectedDigit, invalidTimer) {
    this.font.drawText(this.ctx, padNumber(code, 6, "0"), 0, 28, "center");
    this.font.drawText(this.ctx, "^", selectedDigit * 8 - 20, 18, "center");
    if (invalidTimer > 0) {
      this.font.drawText(this.ctx, "INVALID CODE", 0, 14, "center");
    }
  }

  drawCredits(lines, yOffset = 0) {
    if (lines.length > 0) {
      this.font.drawText(this.ctx, lines[0], -68, 8 + yOffset - 6);
    }
    for (let i = 1; i < lines.length; i++) {
      const offset = i % 2 ? 2 : 0;
      this.font.drawText(this.ctx, lines[i], 0, 16 + i * 11 + yOffset + offset - 6, "center");
    }
  }

  drawPauseMenu(option, stats) {
    this.drawPauseBg();
    this.font.drawText(this.ctx, (option === 0 ? "> " : "  ") + "Return to Game", -108, 24);
    this.font.drawText(this.ctx, (option === 1 ? "> " : "  ") + "Quit to Menu", -108, 34);
    this.font.drawText(this.ctx, "Time", 16, 24);
    this.font.drawText(this.ctx, "Stage", 16, 34);
    this.font.drawText(this.ctx, "Attempts", 16, 44);
    this.font.drawText(this.ctx, stats.time, 102, 24, "right");
    this.font.drawText(this.ctx, stats.stage, 102, 34, "right");
    this.font.drawText(this.ctx, String(stats.attempts), 102, 44, "right");
  }

  drawCongrats(stats) {
    this.drawMenuBg();
    drawTextBanner(this.ctx, this.sprites.text, TEXT_CONGRATS_Y, 0, -20, 170, 20);
    this.font.drawText(this.ctx, "You completed all 33 stages!", 0, 0, "center");
    this.font.drawText(this.ctx, "Moves Taken:", -8, 18, "right");
    this.font.drawText(this.ctx, "Time Taken:", -8, 28, "right");
    this.font.drawText(this.ctx, "Failed Attempts:", -8, 38, "right");
    this.font.drawText(this.ctx, String(stats.moves), 50, 18, "right");
    this.font.drawText(this.ctx, stats.time, 50, 28, "right");
    this.font.drawText(this.ctx, String(stats.failed), 50, 38, "right");
    this.font.drawText(this.ctx, "Space: menu", 0, 58, "center");
  }

  drawTutorialText(text, page, total) {
    this.font.drawText(this.ctx, text, 0, 52, "center");
    this.font.drawText(this.ctx, `${page + 1}/${total}  Space: next  Esc: skip`, 0, 68, "center");
  }
}
