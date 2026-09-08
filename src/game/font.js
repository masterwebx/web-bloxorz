const GLYPH_W = 8;
const GLYPH_H = 8;

const CHARS =
  "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

const LOGO_WIDTHS = [109, 111, 78, 111, 111, 113];

export class PixelFont {
  constructor(image) {
    this.image = image;
  }

  charIndex(ch) {
    if (ch === " ") return -1;
    const idx = CHARS.indexOf(ch);
    return idx >= 0 ? idx : CHARS.indexOf("?");
  }

  drawText(ctx, text, x, y, align = "left") {
    let startX = x;
    if (align === "center") startX = x - (text.length * GLYPH_W) / 2;
    if (align === "right") startX = x - text.length * GLYPH_W;

    let cx = startX;
    for (const ch of text) {
      if (ch !== " ") this.drawChar(ctx, ch, cx, y);
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

export const CURSOR_GLYPH = 29;

export const LOGO_FRAME_H = 20;
export const LOGO_FRAME_COUNT = 6;
export const TEXT_STAGE_Y = 122;
export const TEXT_CONGRATS_Y = 137;

export function drawLogoFrame(ctx, sheet, frame, x, y) {
  const f = Math.max(0, Math.min(frame, LOGO_FRAME_COUNT - 1));
  const sy = f * LOGO_FRAME_H;
  const w = LOGO_WIDTHS[f];
  ctx.drawImage(sheet, 0, sy, w, LOGO_FRAME_H, x - w / 2, y - LOGO_FRAME_H / 2, w, LOGO_FRAME_H);
}

export function drawTextBanner(ctx, sheet, sy, x, y, w = 90, h = 18) {
  ctx.drawImage(sheet, 0, sy, w, h, x - w / 2, y - h / 2, w, h);
}
