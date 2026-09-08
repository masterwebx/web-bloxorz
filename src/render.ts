import type { Assets } from "./assets";
import { STAGE_H, STAGE_W } from "./assets";
import {
  H,
  occupied,
  type Anim,
  type BlockState,
  type Cell,
  type Stage,
  type Tile,
  W,
} from "./engine";

const SX = 32.5;
const SYX = -5;
const SXY = 10;
const SY = 17.5;
const SZ = 23;
const TILE_OX = -2;
const TILE_OY = -6;
const MENU_X = 42;
export const MENU_Y = 148;
export const MENU_GAP = 22;
export const MENU_COUNT = 7;
export const PAUSE_COUNT = 4;
const SETTINGS_Y = 152;
const SETTINGS_GAP = 17;
const UI_FONT = "Orbitron, sans-serif";
/** Shared SWF registration for every 201×151 block frame. */
const SPRITE_OX = -77;
const SPRITE_OY = -94;

export function project(x: number, y: number, z: number): { x: number; y: number } {
  return {
    x: x * SX + y * SXY,
    y: y * SY + x * SYX - z * SZ,
  };
}

export function tileImage(assets: Assets, tile: Tile): HTMLImageElement | null {
  switch (tile) {
    case "stone":
      return assets.tiles.stone;
    case "end":
      return assets.tiles.end;
    case "soft":
      return assets.tiles.soft;
    case "heavy":
      return assets.tiles.heavy;
    case "fragile":
      return assets.tiles.fragile;
    case "split":
      return assets.tiles.split;
    default:
      return null;
  }
}

export interface Camera {
  x: number;
  y: number;
}

export function fitCamera(stage: Stage): Camera {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = stage.tileAt(x, y);
      if (t === "empty") continue;
      const p = project(x, y, 0);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + 50);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + 34);
    }
  }
  if (!Number.isFinite(minX)) return { x: 80, y: 80 };
  return {
    x: STAGE_W / 2 - (minX + maxX) / 2,
    y: STAGE_H / 2 - (minY + maxY) / 2 + 18,
  };
}

const BILLBOARD: Record<string, string[]> = {
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  X: ["10001", "01010", "01010", "00100", "01010", "01010", "10001"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

function ease(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, t)) * Math.PI);
}

function easeOutBack(t: number): number {
  const c = 1.12;
  const p = t - 1;
  return 1 + c * p * p * p + (c - 1) * p * p;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  cam: Camera = { x: 0, y: 0 };
  private knockCache = new Map<HTMLImageElement, HTMLCanvasElement>();

  constructor(
    canvas: HTMLCanvasElement,
    private assets: Assets,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = true;
  }

  private knocked(img: HTMLImageElement): HTMLCanvasElement {
    let c = this.knockCache.get(img);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] <= 6 && px[i + 1] <= 6 && px[i + 2] <= 6) px[i + 3] = 0;
    }
    g.putImageData(data, 0, 0);
    this.knockCache.set(img, c);
    return c;
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  }

  drawBg(kind: "menu" | "level"): void {
    const img = kind === "menu" ? this.assets.ui.menuBg : this.assets.ui.levelBg;
    this.ctx.drawImage(img, 0, 0, STAGE_W, STAGE_H);
    const g = this.ctx.createRadialGradient(200, 90, 20, 260, 180, 420);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }

  drawLevel(stage: Stage): void {
    const scatter = stage.scatter;
    const intro = scatter > 0 ? 1 : stage.assemble;
    for (let y = 0; y < H; y++) {
      for (let x = W - 1; x >= 0; x--) {
        const tile = stage.tileAt(x, y);
        const p = project(x, y, 0);
        const delay = (x + y) * 0.03;
        const t = Math.min(1, Math.max(0, (intro - delay) / 0.42));
        const e = easeOutBack(t);
        if (e <= 0.01) continue;
        const lift = (1 - Math.min(1, e)) * (88 + (x + y) * 3);
        const drift = (1 - Math.min(1, e)) * ((x - 7) * 14 + (y % 2 === 0 ? -10 : 12));
        const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const r = seed - Math.floor(seed);
        const s = scatter;
        const ang = r * Math.PI * 2 + s * Math.PI * 2.35;
        const rad = s * (70 + (x + y) * 9 + r * 50);
        const flyX = Math.cos(ang) * rad;
        const flyY = Math.sin(ang) * rad * 0.62;
        const rot = s * (Math.PI * 2.4 + r * 5.2);
        const dx = this.cam.x + p.x + TILE_OX + drift + flyX;
        const dy = this.cam.y + p.y + TILE_OY - lift + flyY;
        this.ctx.save();
        this.ctx.globalAlpha = Math.min(1, t * 1.4) * (1 - scatter * 0.92);
        this.ctx.translate(dx + 25, dy + 17);
        if (rot) this.ctx.rotate(rot);
        const drawX = -25;
        const drawY = -17;
        if (tile === "bridgeL" || tile === "bridgeR") {
          const b = stage.bridgeAt(x, y)!;
          const fade = Math.min(1, t * 1.4) * (1 - scatter * 0.92);
          this.ctx.globalAlpha = fade;
          const frames = b.kind === "l" ? this.assets.bridges.l : this.assets.bridges.r;
          const fi = Math.max(0, Math.min(frames.length - 1, Math.round(b.frame)));
          this.ctx.drawImage(this.knocked(frames[fi]), drawX - 76, drawY - 90);
          if (b.flash > 0) {
            this.ctx.globalAlpha = Math.min(0.7, b.flash * 2) * fade;
            this.ctx.fillStyle = b.flashOn ? "rgba(70,255,90,0.7)" : "rgba(255,50,40,0.7)";
            this.ctx.translate(-25 - TILE_OX, -17 - TILE_OY);
            this.drawTileOverlay(x, y);
          }
          this.ctx.restore();
          continue;
        }
        const img = tileImage(this.assets, tile);
        if (!img) {
          this.ctx.restore();
          continue;
        }
        this.ctx.drawImage(img, drawX, drawY);
        this.ctx.restore();
      }
    }

    if (intro >= 1 && scatter < 0.08) {
      for (const it of this.blockDrawables(stage)) it.draw();
    }
  }

  private drawTileOverlay(x: number, y: number): void {
    const pts = [
      project(x, y, 0.02),
      project(x + 1, y, 0.02),
      project(x + 1, y + 1, 0.02),
      project(x, y + 1, 0.02),
    ];
    this.ctx.beginPath();
    this.ctx.moveTo(this.cam.x + pts[0].x, this.cam.y + pts[0].y);
    for (let i = 1; i < 4; i++) this.ctx.lineTo(this.cam.x + pts[i].x, this.cam.y + pts[i].y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private blockDrawables(stage: Stage): { depth: number; draw: () => void }[] {
    const anim = stage.anim;
    if (stage.split) {
      const a = this.cubeDrawable(stage, stage.cubeA, stage.active === 0, 0);
      const b = this.cubeDrawable(stage, stage.cubeB, stage.active === 1, 1);
      return [a, b];
    }
    const state = anim && (anim.kind === "roll" || anim.kind === "fall" || anim.kind === "sink" || anim.kind === "drop")
      ? anim.from
      : stage.block;
    const depth = state.y * 20 - state.x + 8;
    return [
      {
        depth,
        draw: () => this.drawBox(stage.block, anim, false),
      },
    ];
  }

  private cubeDrawable(stage: Stage, cell: Cell, active: boolean, which: 0 | 1) {
    const moving = stage.anim?.kind === "roll" && stage.active === which;
    const state: BlockState = { x: cell.x, y: cell.y, ori: "up" };
    return {
      depth: cell.y * 20 - cell.x + 8,
      draw: () => {
        this.drawBox(state, moving ? stage.anim : stage.anim?.kind === "splitdrop" ? stage.anim : null, true, which);
        if (active && stage.selectTimer > 0) this.drawBrackets(cell, stage.selectTimer);
      },
    };
  }

  private drawBrackets(cell: Cell, timer: number): void {
    const p = project(cell.x + 0.5, cell.y + 0.5, 1.2);
    const dist = 18 + (1 - Math.min(1, (0.45 - timer) / 0.45)) * 16;
    const x = this.cam.x + p.x;
    const y = this.cam.y + p.y + 10;
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, timer * 3);
    this.ctx.strokeStyle = "#ffe8c0";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x - dist, y - 10);
    this.ctx.lineTo(x - dist, y + 12);
    this.ctx.moveTo(x + dist, y - 10);
    this.ctx.lineTo(x + dist, y + 12);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawBox(state: BlockState, anim: Anim | null, cube: boolean, which: 0 | 1 = 0): void {
    const moving =
      anim &&
      (anim.kind === "roll" ||
        anim.kind === "fall" ||
        anim.kind === "sink" ||
        anim.kind === "drop" ||
        anim.kind === "splitdrop");
    if (!moving) {
      this.drawBlockShadow(state, cube, 0.42);
      this.blitBlock(this.idleImage(state, cube), state.x, state.y);
      return;
    }
    if (anim?.kind === "drop") {
      const t = ease(anim.t / anim.dur);
      this.drawBlockShadow(anim.to, cube, 0.15 + t * 0.3);
      this.blitBlock(this.idleImage(anim.to, cube), anim.to.x, anim.to.y, (1 - t) * 155);
      return;
    }
    if (anim?.kind === "splitdrop") {
      const t = ease(anim.t / anim.dur);
      const st: BlockState = which === 0
        ? { x: anim.from.x, y: anim.from.y, ori: "up" }
        : { x: anim.to2!.x, y: anim.to2!.y, ori: "up" };
      this.drawBlockShadow(st, true, 0.15 + t * 0.3);
      this.blitBlock(this.assets.block.cube, st.x, st.y, (1 - t) * 130);
      return;
    }
    if (anim?.kind === "roll" && anim.dir) {
      const u = anim.t / anim.dur;
      const t = ease(u);
      const fi = Math.min(7, Math.floor(u * 8));
      const from = anim.from;
      const to = anim.to;
      const pack = cube ? this.assets.block.rolls.cube : this.assets.block.rolls[from.ori];
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const shadow = t < 0.55 ? from : to;
      this.drawBlockShadow(shadow, cube, 0.38);
      this.blitBlock(pack[anim.dir][fi], x, y);
      return;
    }
    if (anim?.kind === "sink") {
      const t = ease(anim.t / anim.dur);
      const fi = Math.min(7, Math.floor((anim.t / anim.dur) * 8));
      this.drawBlockShadow(anim.from, cube, 0.22 * (1 - t));
      this.blitBlock(this.assets.block.sink[fi], anim.from.x, anim.from.y);
      return;
    }
    if (anim?.kind === "fall") {
      const t = anim.t / anim.dur;
      this.drawBlockShadow(anim.from, cube, 0.15 * (1 - t));
      this.blitBlock(this.idleImage(anim.from, cube), anim.from.x, anim.from.y, -t * t * 210, 1 - t * 0.85);
    }
  }

  private drawBlockShadow(state: BlockState, cube: boolean, alpha: number): void {
    const cells = cube ? [{ x: state.x, y: state.y }] : occupied(state);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.filter = "blur(6px)";
    for (const c of cells) {
      const pts = [
        project(c.x + 0.1, c.y + 0.1, 0.02),
        project(c.x + 0.9, c.y + 0.1, 0.02),
        project(c.x + 0.9, c.y + 0.9, 0.02),
        project(c.x + 0.1, c.y + 0.9, 0.02),
      ];
      ctx.beginPath();
      ctx.moveTo(this.cam.x + pts[0].x + 2, this.cam.y + pts[0].y + 1);
      for (let i = 1; i < 4; i++) ctx.lineTo(this.cam.x + pts[i].x + 2, this.cam.y + pts[i].y + 1);
      ctx.closePath();
      ctx.fillStyle = `rgba(48, 22, 14, ${Math.min(1, alpha * 0.82)})`;
      ctx.fill();
    }
    ctx.filter = "none";
    ctx.restore();
  }

  private idleImage(state: BlockState, cube: boolean): HTMLImageElement {
    if (cube) return this.assets.block.cube;
    if (state.ori === "up") return this.assets.block.up;
    if (state.ori === "forward") return this.assets.block.forward;
    return this.assets.block.right;
  }

  private blitBlock(img: HTMLImageElement, x: number, y: number, lift = 0, alpha = 1): void {
    const p = project(x, y, 0);
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.knocked(img), this.cam.x + p.x + SPRITE_OX, this.cam.y + p.y + SPRITE_OY - lift);
    this.ctx.restore();
  }

  private drawUiText(
    text: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      color?: string;
      glow?: boolean;
      align?: CanvasTextAlign;
      weight?: string;
    } = {},
  ): void {
    const ctx = this.ctx;
    const size = opts.size ?? 15;
    ctx.save();
    ctx.font = `${opts.weight ?? "700"} ${size}px ${UI_FONT}`;
    ctx.textAlign = opts.align ?? "left";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const tx = Math.round(x);
    const ty = Math.round(y);
    if (opts.glow) {
      const w = ctx.measureText(text).width;
      const cx = opts.align === "center" ? tx : opts.align === "right" ? tx - w / 2 : tx + w / 2;
      const g = ctx.createRadialGradient(cx, ty - size * 0.35, 2, cx, ty - size * 0.35, Math.max(22, w * 0.42));
      g.addColorStop(0, "rgba(255, 110, 28, 0.22)");
      g.addColorStop(1, "rgba(255, 80, 10, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, ty - size * 0.32, Math.max(18, w * 0.48), size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    ctx.fillText(text, tx + 1, ty + 1);
    ctx.fillStyle = opts.color ?? "#fff8e8";
    ctx.fillText(text, tx, ty);
    ctx.restore();
  }

  drawHud(code: string, moves: number, tab = "Menu"): void {
    this.drawMenuTab(tab);
    this.drawUiText(`Passcode: ${code}`, 536, 18, { size: 13, align: "right", weight: "500" });
    this.drawUiText(`Moves: ${String(moves).padStart(6, "0")}`, 536, 36, { size: 13, align: "right", weight: "500" });
  }

  drawMenuTab(label = "Menu"): void {
    this.drawUiText(label, 14, 20, { size: 13, weight: "500" });
  }

  hitMenuTab(mx: number, my: number, wide = false): boolean {
    return mx >= 8 && mx <= (wide ? 168 : 70) && my >= 6 && my <= 28;
  }

  drawTitle(levelIndex: number, alpha: number, shake: { x: number; y: number }): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    const n = String(levelIndex + 1).padStart(2, "0");
    this.drawUiText(`STAGE ${n}`, STAGE_W / 2 + shake.x, 214 + shake.y, {
      size: 36,
      glow: true,
      align: "center",
    });
    ctx.restore();
  }

  drawLogo(x: number, y: number, neonR = 1, neonZ = 1, glitch = 0): void {
    const ctx = this.ctx;
    const pitch = 5.5;
    const radius = 2.25;
    const letters = "BLOXORZ";
    ctx.save();
    ctx.translate(x + glitch, y);
    letters.split("").forEach((ch, li) => {
      const glyph = BILLBOARD[ch];
      const on = ch === "R" ? neonR : ch === "Z" ? neonZ : 1;
      const ox = li * (5 + 1) * pitch;
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] !== "1") continue;
          const bx = ox + col * pitch + 2.4;
          const by = row * pitch + 2.4;
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, 8.2);
          g.addColorStop(0, `rgba(255, 230, 170, ${0.95 * on})`);
          g.addColorStop(0.28, `rgba(255, 150, 40, ${0.8 * on})`);
          g.addColorStop(1, "rgba(255, 90, 0, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(bx, by, 8.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255, 248, 228, ${0.4 + 0.6 * on})`;
          ctx.beginPath();
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
    ctx.restore();
  }

  drawMenuButtons(
    selected: number,
    originY: number,
    _hover: number | null,
    muted: boolean,
    canResume: boolean,
  ): void {
    const labels = [
      "Start New Game",
      "Resume Game",
      "Load Stage",
      "Stage Creator",
      "Settings",
      "Toggle Sound",
      "Credits",
    ];
    labels.forEach((label, i) => {
      const y = originY + i * MENU_GAP;
      const dim = i === 1 && !canResume;
      this.ctx.save();
      this.ctx.globalAlpha = dim ? 0.32 : 1;
      if (i === selected && !dim) this.drawUiText(">", MENU_X - 16, y + 16, { size: 14, glow: true });
      this.drawUiText(label, MENU_X + 4, y + 16, { size: 14, glow: true });
      if (i === 5) this.drawUiText(muted ? "Off" : "On", MENU_X + 172, y + 16, { size: 14, glow: true });
      this.ctx.restore();
    });
  }

  drawSpinBlock(frame: number, x: number, y: number): void {
    const frames = this.assets.block.spin;
    const img = frames[Math.max(0, Math.min(frames.length - 1, frame))];
    const scale = 0.86;
    this.ctx.save();
    const gx = x + img.width * scale * 0.48;
    const gy = y + img.height * scale * 0.55;
    const glow = this.ctx.createRadialGradient(gx, gy, 6, gx, gy, 78);
    glow.addColorStop(0, "rgba(255, 120, 30, 0.4)");
    glow.addColorStop(0.5, "rgba(180, 50, 10, 0.16)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(gx, gy, 78, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.drawImage(this.knocked(img), x, y, img.width * scale, img.height * scale);
    this.ctx.restore();
  }

  drawAskInstructions(selected: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.fillStyle = "rgba(8,4,2,0.88)";
    ctx.fillRect(90, 140, 370, 130);
    ctx.strokeStyle = "rgba(255,180,100,0.4)";
    ctx.strokeRect(90.5, 140.5, 370, 130);
    ctx.fillStyle = "#fff4d6";
    this.drawUiText("Would you like to view the instructions?", STAGE_W / 2, 178, {
      size: 14,
      glow: true,
      align: "center",
      color: "#fff4d6",
    });
    const opts = ["Yes", "No"];
    opts.forEach((label, i) => {
      const y = 214 + i * 26;
      this.drawUiText(i === selected ? `> ${label}` : `  ${label}`, 210, y, {
        size: 15,
        glow: true,
        color: i === selected ? "#fff4d6" : "#c8b8a0",
      });
    });
    ctx.restore();
  }

  drawPublisherSplash(alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.globalAlpha = alpha;
    const presented = this.assets.splash.presented;
    const logo = this.assets.splash.addicting;
    const tag = this.assets.splash.tagline;
    ctx.drawImage(presented, (STAGE_W - presented.width) / 2, 88);
    ctx.drawImage(logo, (STAGE_W - logo.width) / 2, 158);
    ctx.drawImage(tag, (STAGE_W - tag.width) / 2, 248);
    ctx.restore();
  }

  drawAuthorCard(alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.globalAlpha = alpha;
    const lines = [
      "All graphics, audio, actionscript and puzzles",
      "in Bloxorz created by Damien Clarke,",
      "DX Interactive, 21st June 2007.",
    ];
    lines.forEach((line, i) => {
      this.drawUiText(line, STAGE_W / 2, 178 + i * 28, {
        size: 14,
        align: "center",
        weight: "500",
      });
    });
    ctx.restore();
  }

  hitMenu(mx: number, my: number, originY: number, count: number): number | null {
    for (let i = 0; i < count; i++) {
      const y = originY + i * MENU_GAP;
      if (mx >= MENU_X - 20 && mx <= MENU_X + 220 && my >= y && my <= y + 24) return i;
    }
    return null;
  }

  hitAsk(mx: number, my: number): number | null {
    if (mx < 200 || mx > 340) return null;
    if (my >= 196 && my < 220) return 0;
    if (my >= 220 && my < 246) return 1;
    return null;
  }

  drawUiPrompt(text: string, x: number, y: number): void {
    this.drawUiText(text, x, y, { size: 14, glow: true, color: "#ffc37a" });
  }

  drawCredits(): void {
    const lines = [
      "Credits",
      "Original game created by Damien Clarke,",
      "DX Interactive, 21st June 2007.",
      "HTML remake uses the reconstructed 33-stage",
      "maps from Jacob Coughenour's GBA port.",
      "Click or press any key to return.",
    ];
    lines.forEach((line, i) => {
      this.drawUiText(line, STAGE_W / 2, 210 + i * 22, {
        size: i === 0 ? 18 : 13,
        glow: true,
        align: "center",
        weight: i === 0 ? "700" : "500",
      });
    });
  }

  drawLoad(code: string, cursor: number, invalid: boolean): void {
    const ctx = this.ctx;
    ctx.save();
    this.drawUiText("Type the passcode", STAGE_W / 2, 210, { size: 16, glow: true, align: "center" });
    const dw = 22;
    const startX = STAGE_W / 2 - (6 * dw) / 2;
    const digits = code.padEnd(6, " ").split("");
    digits.forEach((ch, i) => {
      const x = startX + i * dw;
      this.drawUiText(ch === " " ? "_" : ch, x + dw / 2, 248, { size: 22, glow: true, align: "center" });
      if (i === cursor) this.drawUiText("^", x + dw / 2, 270, { size: 14, glow: true, align: "center" });
    });
    this.drawUiText("Enter", STAGE_W / 2, 304, { size: 14, glow: true, align: "center" });
    this.drawUiText("Back", 36, STAGE_H - 18, { size: 13, glow: true });
    if (invalid) this.drawUiText("INVALID CODE", STAGE_W / 2, 338, { size: 14, glow: true, align: "center", color: "#ff6a55" });
    ctx.restore();
  }

  drawTutorial(slide: number, offsetY: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    const lines = TUTORIAL[slide] ?? [];
    lines.forEach((line, i) => {
      this.drawUiText(line, 22, 36 + offsetY + i * 20, {
        size: i === 0 ? 15 : 12,
        weight: i === 0 ? "700" : "500",
        color: "#fff4d6",
      });
    });
    const art = this.assets.tutorial[slide];
    ctx.drawImage(art, 360, 18 + offsetY, 175, 171);
    this.drawUiText("Skip", STAGE_W - 70, 24, { size: 13, glow: true, align: "right" });
    this.drawUiText("Back", 40, STAGE_H - 18, { size: 13, glow: true });
    this.drawUiText(slide < 8 ? "Next" : "Start", STAGE_W - 40, STAGE_H - 18, { size: 13, glow: true, align: "right" });
    ctx.restore();
  }

  hitTutorialNav(mx: number, my: number): "back" | "next" | "skip" | null {
    if (my < 40 && mx > STAGE_W - 200) return "skip";
    if (my < STAGE_H - 48) return null;
    if (mx < 160) return "back";
    if (mx > STAGE_W - 170) return "next";
    return null;
  }

  drawPause(
    selected: number,
    time: string,
    stage: number,
    attempts: number,
    muted: boolean,
    slide: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.28 * slide})`;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    this.drawMenuTab();
    const e = 1 - Math.pow(1 - Math.min(1, slide), 3);
    const leftX = -240 + (28 + 240) * e;
    const rightX = 560 + (300 - 560) * e;
    ctx.fillStyle = "#000";
    ctx.fillRect(leftX, 128, 236, 168);
    ctx.fillRect(rightX, 154, 220, 100);
    const opts = ["Return to Game", "Restart Level", "Toggle Sound", "Quit to Menu"];
    opts.forEach((label, i) => {
      const y = 158 + i * 32;
      if (i === selected) this.drawUiText(">", leftX + 8, y, { size: 14, glow: true });
      this.drawUiText(label, leftX + 28, y, { size: 14, glow: true });
      if (i === 2) this.drawUiText(muted ? "Off" : "On", leftX + 182, y, { size: 14, glow: true });
    });
    this.drawUiText("Time:", rightX + 18, 186, { size: 14, glow: true });
    this.drawUiText("Stage:", rightX + 18, 210, { size: 14, glow: true });
    this.drawUiText("Attempts:", rightX + 18, 234, { size: 14, glow: true });
    this.drawUiText(time, rightX + 204, 186, { size: 14, glow: true, align: "right" });
    this.drawUiText(String(stage + 1).padStart(2, "0"), rightX + 204, 210, { size: 14, glow: true, align: "right" });
    this.drawUiText(String(attempts), rightX + 204, 234, { size: 14, glow: true, align: "right" });
    ctx.restore();
  }

  drawComplete(moves: number, time: string, fails: number): void {
    this.drawBg("menu");
    this.drawUiText("Congratulations", STAGE_W / 2, 92, { size: 22, glow: true, align: "center" });
    this.drawUiText("You completed the 33 stages of Bloxorz!", STAGE_W / 2, 150, { size: 14, glow: true, align: "center" });
    this.drawUiText("Moves Taken:", STAGE_W / 2 + 20, 200, { size: 14, glow: true, align: "right" });
    this.drawUiText("Time Taken:", STAGE_W / 2 + 20, 224, { size: 14, glow: true, align: "right" });
    this.drawUiText("Failed Attempts:", STAGE_W / 2 + 20, 248, { size: 14, glow: true, align: "right" });
    this.drawUiText(String(moves), STAGE_W / 2 + 32, 200, { size: 14, glow: true });
    this.drawUiText(time, STAGE_W / 2 + 32, 224, { size: 14, glow: true });
    this.drawUiText(String(fails), STAGE_W / 2 + 32, 248, { size: 14, glow: true });
    this.drawUiText("Press Enter or click to return to the menu", STAGE_W / 2, 310, { size: 13, glow: true, align: "center", color: "#ffb060" });
  }

  hitPause(mx: number, my: number): number | null {
    if (mx < 28 || mx > 264 || my < 142 || my > 286) return null;
    return Math.max(0, Math.min(3, Math.floor((my - 142) / 32)));
  }

  drawSettingsPanel(
    rows: { label: string; value: string }[],
    selected: number,
    listen: string | null,
  ): void {
    this.drawUiText("Settings", 42, 130, { size: 18, glow: true });
    rows.forEach((row, i) => {
      const y = SETTINGS_Y + i * SETTINGS_GAP;
      if (i === selected) this.drawUiText(">", 28, y, { size: 13, glow: true });
      this.drawUiText(row.label, 48, y, { size: 13, glow: true });
      this.drawUiText(row.value, 520, y, { size: 13, glow: true, align: "right" });
    });
    this.drawUiText("Left / Right change values. Enter rebinds a key.", 42, 368, {
      size: 11,
      glow: true,
      weight: "500",
    });
    this.drawUiText(listen ?? "Shift+Enter or click right to rebind a button. Esc back.", 42, 386, {
      size: 11,
      glow: true,
      weight: "500",
    });
  }

  drawCreatorHub(selected: number): void {
    this.drawUiText("Stage Creator", 42, 140, { size: 18, glow: true });
    ["Create", "Play", "Back"].forEach((label, i) => {
      const y = 180 + i * 28;
      if (i === selected) this.drawUiText(">", 28, y, { size: 15, glow: true });
      this.drawUiText(label, 48, y, { size: 15, glow: true });
    });
  }

  drawEditor(
    cells: string[],
    spawn: [number, number],
    tool: string,
    tools: string[],
    hint: string,
    name: string,
    nameFocus: boolean,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = nameFocus ? "rgba(60, 28, 12, 0.72)" : "rgba(32, 16, 8, 0.55)";
    ctx.fillRect(12, 6, 300, 22);
    ctx.strokeStyle = nameFocus ? "#ffcc88" : "rgba(255, 196, 120, 0.5)";
    ctx.lineWidth = nameFocus ? 1.5 : 1;
    ctx.strokeRect(12.5, 6.5, 299, 21);
    ctx.restore();
    const shown = nameFocus ? `Name: ${name}_` : `Name: ${name}`;
    this.drawUiText(shown, 20, 22, { size: 13, glow: true, color: nameFocus ? "#fff4d6" : "#ffe0b0" });
    this.drawUiText("Test", 430, 22, { size: 13, glow: true });
    this.drawUiText("Back", 510, 22, { size: 13, glow: true });
    const ox = 36;
    const oy = 40;
    const cs = 24;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) {
        const ch = cells[y][x] ?? " ";
        const px = ox + x * cs;
        const py = oy + y * cs;
        this.ctx.fillStyle = editorColor(ch);
        this.ctx.fillRect(px, py, cs - 1, cs - 1);
        if (spawn[0] === x && spawn[1] === y) {
          this.ctx.strokeStyle = "#ffcc66";
          this.ctx.strokeRect(px + 1, py + 1, cs - 3, cs - 3);
        }
      }
    }
    tools.forEach((t, i) => {
      const x = 410;
      const y = 48 + i * 22;
      if (t === tool) this.drawUiText(">", x - 14, y, { size: 12, glow: true });
      this.drawUiText(t, x, y, { size: 12, glow: true });
    });
    this.drawUiText(hint, 16, 390, { size: 11, glow: true, weight: "500" });
  }

  hitEditorCell(mx: number, my: number): { x: number; y: number } | null {
    const x = Math.floor((mx - 36) / 24);
    const y = Math.floor((my - 40) / 24);
    if (x < 0 || x >= 15 || y < 0 || y >= 10) return null;
    return { x, y };
  }

  hitEditorTool(mx: number, my: number, count: number): number | null {
    if (mx < 396 || mx > 540) return null;
    const i = Math.floor((my - 34) / 22);
    if (i < 0 || i >= count) return null;
    return i;
  }

  hitEditorHeader(mx: number, my: number): "test" | "back" | null {
    if (my > 30) return null;
    if (mx >= 400 && mx < 480) return "test";
    if (mx >= 490) return "back";
    return null;
  }

  hitEditorName(mx: number, my: number): boolean {
    return mx >= 12 && mx <= 312 && my >= 6 && my <= 28;
  }

  hitSettings(mx: number, my: number, count: number): { row: number; side: "left" | "right" } | null {
    if (mx < 24 || mx > 530) return null;
    const i = Math.floor((my - (SETTINGS_Y - 12)) / SETTINGS_GAP);
    if (i < 0 || i >= count) return null;
    return { row: i, side: mx > 360 ? "right" : "left" };
  }

  hitCreatorHub(mx: number, my: number): number | null {
    if (mx < 24 || mx > 280) return null;
    const i = Math.floor((my - 162) / 28);
    if (i < 0 || i > 2) return null;
    return i;
  }

  hitSavePrompt(_mx: number, my: number): number | null {
    if (my >= 214 && my <= 240) return 0;
    if (my >= 244 && my <= 270) return 1;
    return null;
  }

  drawCustomPlay(names: string[], selected: number, paste: string, msg: string): void {
    this.drawUiText("Play Custom Stages", 42, 130, { size: 18, glow: true });
    if (!names.length) this.drawUiText("No saved stages yet.", 48, 168, { size: 13, glow: true });
    names.slice(0, 7).forEach((n, i) => {
      const y = 160 + i * 22;
      if (i === selected) this.drawUiText(">", 28, y, { size: 13, glow: true });
      this.drawUiText(n, 48, y, { size: 13, glow: true });
    });
    this.drawUiText("Paste share code:", 42, 330, { size: 13, glow: true });
    this.drawUiText(paste || "_", 48, 352, { size: 12, glow: true, weight: "500" });
    this.drawUiText(msg, 42, 374, { size: 12, glow: true, color: "#ffb070" });
    this.drawUiText("Enter play  Del delete  Esc back", 42, 392, { size: 11, glow: true, weight: "500" });
  }

  drawSavePrompt(code: string, msg: string): void {
    this.drawUiText("Stage beaten — it can be saved.", 275, 160, { size: 16, glow: true, align: "center" });
    this.drawUiText(`Name: ${msg}_`, 275, 190, { size: 13, glow: true, align: "center" });
    this.drawUiText("Save & Copy Code", 275, 230, { size: 15, glow: true, align: "center" });
    this.drawUiText("Keep Editing", 275, 258, { size: 15, glow: true, align: "center" });
    this.drawUiText(code.length > 48 ? `${code.slice(0, 42)}…` : code, 275, 300, {
      size: 10,
      glow: true,
      align: "center",
      weight: "500",
      color: "#c8b8a0",
    });
  }
}

function editorColor(ch: string): string {
  switch (ch) {
    case "b":
      return "#9aa4a8";
    case "e":
      return "#1a1210";
    case "s":
      return "#c09040";
    case "h":
      return "#8a6030";
    case "f":
      return "#d07030";
    case "v":
      return "#6090c0";
    case "l":
    case "k":
    case "r":
    case "q":
      return "#6a5040";
    default:
      return "#221818";
  }
}

export const TUTORIAL: string[][] = [
  [
    "1 / 9",
    "",
    "The aim of the game is to get the block",
    "to fall into the square hole at the end",
    "of each stage.",
    "",
    "There are 33 stages to complete.",
  ],
  [
    "2 / 9",
    "",
    "To move the block around the world, use",
    "the left, right, up and down arrow keys.",
    "",
    "Be careful not to fall off the edges —",
    "the level will be restarted if this",
    "happens.",
  ],
  [
    "3 / 9",
    "",
    "Bridges and switches are located in many",
    "levels. The switches are activated when",
    "they are pressed down by the block.",
    "You do not need to stay resting on the",
    "switch to keep bridges closed.",
  ],
  [
    "4 / 9",
    "",
    "There are two types of switches:",
    "Heavy X-shaped ones and soft round ones.",
    "Soft switches activate when any part of",
    "your block presses them. Hard switches",
    "need much more pressure, so the block",
    "must be standing on its end.",
  ],
  [
    "5 / 9",
    "",
    "Each switch may behave differently.",
    "Some swap bridges from open to closed",
    "each time they are used. Some only ever",
    "open a bridge. Green or red squares flash",
    "to indicate which bridges are operated.",
  ],
  [
    "6 / 9",
    "",
    "Orange tiles are more fragile than the",
    "rest of the land.",
    "If your block stands up vertically on an",
    "orange tile, the tile will give way and",
    "your block will fall.",
  ],
  [
    "7 / 9",
    "",
    "There is a third type of switch:  ( )",
    "It teleports your block to different",
    "locations, splitting it into two smaller",
    "blocks. These can be controlled separately",
    "and rejoin when placed next to each other.",
  ],
  [
    "8 / 9",
    "",
    "Select which small block to use at any",
    "time by pressing the spacebar.",
    "Small blocks can operate soft switches,",
    "but they cannot activate heavy switches",
    "or finish a stage — only a complete block",
    "can fall through the exit hole.",
  ],
  [
    "9 / 9",
    "",
    "Remember the passcode for each stage.",
    "It is in the top right corner.",
    "You can skip back to a stage later from",
    "Load Stage in the main menu by entering",
    "the 6 digit level code.",
    "",
    "Enjoy!",
  ],
];

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${String(ss).padStart(2, "0")}`;
}
