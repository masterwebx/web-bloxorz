const GLYPH_W = 8;
const GLYPH_H = 8;

// Matches Butano common_variable_8x8_font tile order (starts at '!')
const CHARS =
  "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

export class PixelFont {
  constructor(image) {
    this.image = image;
    this.cache = new Map();
  }

  charIndex(ch) {
    if (ch === " ") return -1;
    const idx = CHARS.indexOf(ch);
    return idx >= 0 ? idx : CHARS.indexOf("?");
  }

  measureText(text) {
    return text.length * GLYPH_W;
  }

  drawText(ctx, text, x, y, align = "left") {
    let startX = x;
    if (align === "center") startX = x - (text.length * GLYPH_W) / 2;
    if (align === "right") startX = x - text.length * GLYPH_W;

    let cx = startX;
    for (const ch of text) {
      if (ch !== " ") {
        this.drawChar(ctx, ch, cx, y);
      }
      cx += GLYPH_W;
    }
  }

  drawChar(ctx, ch, x, y) {
    const idx = this.charIndex(ch);
    if (idx < 0) return;
    ctx.drawImage(this.image, 0, idx * GLYPH_H, GLYPH_W, GLYPH_H, x, y, GLYPH_W, GLYPH_H);
  }

  drawGlyph(ctx, index, x, y) {
    ctx.drawImage(this.image, 0, index * GLYPH_H, GLYPH_W, GLYPH_H, x, y, GLYPH_W, GLYPH_H);
  }
}

export const CURSOR_GLYPH = 29; // '>'

export const LOGO_FRAME_H = 20;
export const LOGO_FRAME_COUNT = 6;
export const TEXT_STAGE_Y = 122;
export const TEXT_CONGRATS_Y = 137;

export function drawLogoFrame(ctx, sheet, frame, x, y) {
  const clamped = Math.max(0, Math.min(frame, LOGO_FRAME_COUNT - 1));
  const sy = clamped * LOGO_FRAME_H;
  ctx.drawImage(sheet, 0, sy, 213, LOGO_FRAME_H, x - 106, y - 10, 213, LOGO_FRAME_H);
}

export function drawTextBanner(ctx, sheet, sy, x, y, w = 213, h = 20) {
  ctx.drawImage(sheet, 0, sy, w, h, x - w / 2, y - h / 2, w, h);
}
