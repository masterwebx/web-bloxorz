import type { Assets } from "./assets";
import { STAGE_H, STAGE_W } from "./assets";
import {
  H,
  occupied,
  type Anim,
  type BlockState,
  type Cell,
  type Dir,
  type Stage,
  type Tile,
  W,
} from "./engine";

const SX = 32.5;
const SYX = -5;
const SXY = 10;
const SY = 17.5;
const SZ = 23;
const GROUND = 0.04;
const TILE_OX = -2;
const TILE_OY = -6;
const HUD_DIGIT_W = 201 / 10;
const HUD_DIGIT_H = 23;
const MENU_X = 42;
export const MENU_Y = 168;
export const MENU_GAP = 26;
export const MENU_COUNT = 5;
const UI_FONT = "Orbitron, sans-serif";
/** 329.png is ordered 1–9, then 0. Values are [sx0, sx1]. */
const STAGE_DIGIT_RUNS: [number, number][] = [
  [406, 449],
  [4, 33],
  [34, 78],
  [80, 125],
  [126, 171],
  [172, 219],
  [220, 266],
  [267, 311],
  [312, 357],
  [358, 404],
];

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

function rotateAround(
  p: [number, number, number],
  origin: [number, number, number],
  axis: [number, number, number],
  angle: number,
): [number, number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [ox, oy, oz] = origin;
  const x = p[0] - ox;
  const y = p[1] - oy;
  const z = p[2] - oz;
  const [ax, ay, az] = axis;
  const dot = x * ax + y * ay + z * az;
  const cx = ay * z - az * y;
  const cy = az * x - ax * z;
  const cz = ax * y - ay * x;
  return [
    ox + x * c + cx * s + ax * dot * (1 - c),
    oy + y * c + cy * s + ay * dot * (1 - c),
    oz + z * c + cz * s + az * dot * (1 - c),
  ];
}

export function boxFor(block: BlockState, cube = false): { x: number; y: number; z: number; w: number; d: number; h: number } {
  if (cube) return { x: block.x, y: block.y, z: GROUND, w: 1, d: 1, h: 1 };
  if (block.ori === "up") return { x: block.x, y: block.y, z: GROUND, w: 1, d: 1, h: 2 };
  if (block.ori === "forward") return { x: block.x, y: block.y, z: GROUND, w: 1, d: 2, h: 1 };
  return { x: block.x, y: block.y, z: GROUND, w: 2, d: 1, h: 1 };
}

function rollSpec(from: BlockState, dir: Dir, cube: boolean): {
  origin: [number, number, number];
  axis: [number, number, number];
  angle: number;
} {
  const b = boxFor(from, cube);
  const z = b.z;
  if (dir === "right") {
    return { origin: [b.x + b.w, b.y, z], axis: [0, 1, 0], angle: Math.PI / 2 };
  }
  if (dir === "left") {
    return { origin: [b.x, b.y, z], axis: [0, 1, 0], angle: -Math.PI / 2 };
  }
  if (dir === "down") {
    return { origin: [b.x, b.y + b.d, z], axis: [1, 0, 0], angle: -Math.PI / 2 };
  }
  return { origin: [b.x, b.y, z], axis: [1, 0, 0], angle: Math.PI / 2 };
}

function boxCorners(
  box: { x: number; y: number; z: number; w: number; d: number; h: number },
  roll?: { origin: [number, number, number]; axis: [number, number, number]; angle: number },
): [number, number, number][] {
  const pts: [number, number, number][] = [
    [box.x, box.y, box.z],
    [box.x + box.w, box.y, box.z],
    [box.x + box.w, box.y + box.d, box.z],
    [box.x, box.y + box.d, box.z],
    [box.x, box.y, box.z + box.h],
    [box.x + box.w, box.y, box.z + box.h],
    [box.x + box.w, box.y + box.d, box.z + box.h],
    [box.x, box.y + box.d, box.z + box.h],
  ];
  if (!roll) return pts;
  return pts.map((p) => rotateAround(p, roll.origin, roll.axis, roll.angle));
}

const FACES: number[][] = [
  [4, 5, 6, 7],
  [0, 3, 2, 1],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];

const FACE_COL = [
  [196, 132, 108],
  [42, 32, 30],
  [118, 82, 68],
  [88, 62, 52],
  [70, 50, 42],
  [150, 96, 78],
];

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
  private noise: CanvasPattern;
  private rust: CanvasPattern;
  private knockCache = new Map<HTMLImageElement, HTMLCanvasElement>();

  constructor(
    canvas: HTMLCanvasElement,
    private assets: Assets,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = true;
    this.noise = this.makeNoise();
    this.rust = this.makeRust();
  }

  private makeRust(): CanvasPattern {
    const src = this.assets.block.up;
    const c = document.createElement("canvas");
    c.width = 28;
    c.height = 28;
    const g = c.getContext("2d")!;
    g.drawImage(src, 90, 52, 28, 28, 0, 0, 28, 28);
    const data = g.getImageData(0, 0, 28, 28);
    for (let i = 0; i < data.data.length; i += 4) data.data[i + 3] = 255;
    g.putImageData(data, 0, 0);
    return this.ctx.createPattern(c, "repeat") ?? this.noise;
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
      if (px[i] < 12 && px[i + 1] < 12 && px[i + 2] < 12) px[i + 3] = 0;
    }
    g.putImageData(data, 0, 0);
    this.knockCache.set(img, c);
    return c;
  }

  private makeNoise(): CanvasPattern {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const g = c.getContext("2d")!;
    const img = g.createImageData(64, 64);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 70 + Math.random() * 90;
      const rust = Math.random() > 0.72;
      img.data[i] = rust ? 160 + Math.random() * 50 : n * 0.95;
      img.data[i + 1] = rust ? 90 + Math.random() * 40 : n * 0.7;
      img.data[i + 2] = rust ? 70 + Math.random() * 30 : n * 0.62;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return this.ctx.createPattern(c, "repeat")!;
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
        const s = scatter * scatter;
        const flyX = Math.cos(r * Math.PI * 2) * s * 160;
        const flyY = Math.sin(r * Math.PI * 2) * s * 110 - s * 30;
        const rot = (r - 0.5) * s * 7.4;
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
          const vis = b.frame / 7;
          if (vis <= 0.02) {
            this.ctx.restore();
            continue;
          }
          this.ctx.globalAlpha = Math.min(1, t * 1.4) * Math.min(1, vis) * (1 - scatter * 0.92);
          const rise = (1 - vis) * 10;
          this.ctx.drawImage(this.assets.tiles.stone, drawX, drawY + rise);
          if (b.flash > 0) {
            this.ctx.globalAlpha = Math.min(0.7, b.flash * 2) * Math.min(1, t * 1.4) * (1 - scatter);
            this.ctx.fillStyle = b.flashOn ? "rgba(70,255,90,0.7)" : "rgba(255,50,40,0.7)";
            this.ctx.translate(-this.cam.x - p.x - TILE_OX, -this.cam.y - p.y - TILE_OY);
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
      this.drawBlockSprite(state, cube);
      return;
    }
    if (anim?.kind === "drop") {
      const t = ease(anim.t / anim.dur);
      this.drawBlockShadow(anim.to, cube, 0.15 + t * 0.3);
      this.drawBlockSprite(anim.to, cube, (1 - t) * 155);
      return;
    }
    if (anim?.kind === "splitdrop") {
      const t = ease(anim.t / anim.dur);
      const st: BlockState = which === 0
        ? { x: anim.from.x, y: anim.from.y, ori: "up" }
        : { x: anim.to2!.x, y: anim.to2!.y, ori: "up" };
      this.drawBlockShadow(st, true, 0.15 + t * 0.3);
      this.drawBlockSprite(st, true, (1 - t) * 130);
      return;
    }
    const ctx = this.ctx;
    let extraZ = 0;
    let alpha = 1;
    let roll: { origin: [number, number, number]; axis: [number, number, number]; angle: number } | undefined;
    let boxState = state;

    if (anim?.kind === "roll" && anim.dir) {
      const t = ease(anim.t / anim.dur);
      const from = anim.from;
      boxState = from;
      const spec = rollSpec(from, anim.dir, cube);
      roll = { ...spec, angle: spec.angle * t };
    } else if (anim?.kind === "fall") {
      const t = anim.t / anim.dur;
      extraZ = -t * t * 9;
      alpha = 1 - t * 0.9;
      if (anim.dir) {
        const spec = rollSpec(anim.from, anim.dir, cube);
        roll = { ...spec, angle: spec.angle * (1 + 0.4 * t) };
      }
      boxState = anim.from;
    } else if (anim?.kind === "sink") {
      const t = ease(anim.t / anim.dur);
      extraZ = -t * 2.2;
      alpha = 1 - t;
      boxState = anim.from;
    }

    const box = boxFor(boxState, cube);
    const corners = boxCorners(box, roll);
    if (extraZ !== 0) {
      for (const c of corners) c[2] += extraZ;
    }
    const screen = corners.map((c) => {
      const p = project(c[0], c[1], c[2]);
      return { x: this.cam.x + p.x, y: this.cam.y + p.y, z: c[2], d: p.y };
    });

    const faces = FACES.map((idx, fi) => {
      const pts = idx.map((i) => screen[i]);
      const ax = pts[1].x - pts[0].x;
      const ay = pts[1].y - pts[0].y;
      const bx = pts[2].x - pts[1].x;
      const by = pts[2].y - pts[1].y;
      const cross = ax * by - ay * bx;
      const depth = (pts[0].d + pts[1].d + pts[2].d + pts[3].d) / 4;
      return { pts, cross, depth, fi };
    }).sort((a, b) => a.depth - b.depth);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    this.drawBlockShadow(boxState, cube, anim?.kind === "fall" || anim?.kind === "sink" ? alpha * 0.25 : 0.38);
    for (const f of faces) {
      if (f.cross <= 0) continue;
      if (f.fi === 1 && extraZ >= -0.08) continue;
      ctx.beginPath();
      ctx.moveTo(f.pts[0].x, f.pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
      ctx.closePath();
      const [r, g, b] = FACE_COL[f.fi];
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.rust;
      ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(22,12,8,0.9)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBlockShadow(state: BlockState, cube: boolean, alpha: number): void {
    const cells = cube ? [{ x: state.x, y: state.y }] : occupied(state);
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(6, 2, 0, ${alpha})`;
    const ox = 10;
    const oy = 5;
    for (const c of cells) {
      const pts = [
        project(c.x, c.y, 0.01),
        project(c.x + 1, c.y, 0.01),
        project(c.x + 1, c.y + 1, 0.01),
        project(c.x, c.y + 1, 0.01),
      ];
      ctx.beginPath();
      ctx.moveTo(this.cam.x + pts[0].x + ox, this.cam.y + pts[0].y + oy);
      for (let i = 1; i < 4; i++) ctx.lineTo(this.cam.x + pts[i].x + ox, this.cam.y + pts[i].y + oy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBlockSprite(state: BlockState, cube: boolean, lift = 0): void {
    const img = cube
      ? this.assets.block.cube
      : state.ori === "up"
        ? this.assets.block.up
        : state.ori === "forward"
          ? this.assets.block.forward
          : this.assets.block.right;
    const p = project(state.x, state.y, 0);
    const foot =
      cube || state.ori === "up"
        ? { ax: 93, ay: 114, sx: 16, sy: 20 }
        : state.ori === "forward"
          ? { ax: 82, ay: 98, sx: 26, sy: 38 }
          : { ax: 124, ay: 109, sx: 16, sy: 21 };
    const x = this.cam.x + p.x + foot.sx - foot.ax;
    const y = this.cam.y + p.y + foot.sy - foot.ay - lift;
    this.ctx.drawImage(this.knocked(img), x, y);
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
    ctx.save();
    ctx.font = `${opts.weight ?? "700"} ${opts.size ?? 15}px ${UI_FONT}`;
    ctx.textAlign = opts.align ?? "left";
    ctx.textBaseline = "alphabetic";
    if (opts.glow) {
      ctx.shadowColor = "rgba(210, 72, 16, 0.95)";
      ctx.shadowBlur = 7;
      ctx.fillStyle = "#ffc080";
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = opts.color ?? "#ffffff";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawHud(code: string, moves: number): void {
    const ctx = this.ctx;
    ctx.save();
    this.drawMenuTab();
    const sample = ctx.getImageData(508, 10, 1, 1).data;
    ctx.fillStyle = `rgb(${sample[0]},${sample[1]},${sample[2]})`;
    ctx.fillRect(392, 4, 158, 40);
    this.drawUiText("Passcode:", 398, 18, { size: 11, color: "#140c08", weight: "700" });
    this.drawUiText(code, 478, 18, { size: 11, color: "#140c08", weight: "700" });
    this.drawUiText("Moves:", 422, 36, { size: 11, color: "#140c08", weight: "700" });
    this.drawUiText(String(moves).padStart(6, "0"), 478, 36, { size: 11, color: "#140c08", weight: "700" });
    ctx.restore();
  }

  drawMenuTab(): void {
    const ctx = this.ctx;
    const x = 8;
    const y = 8;
    const w = 62;
    const h = 18;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#e8b060");
    g.addColorStop(0.5, "#c07830");
    g.addColorStop(1, "#8a4014");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(40, 16, 4, 0.5)";
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    this.drawUiText("Menu", x + 31, y + 14, { size: 11, color: "#140c08", align: "center", weight: "700" });
  }

  hitMenuTab(mx: number, my: number): boolean {
    return mx >= 8 && mx <= 70 && my >= 8 && my <= 26;
  }

  private drawSpriteDigits(
    sheet: HTMLImageElement,
    text: string,
    x: number,
    y: number,
    dw = HUD_DIGIT_W,
    dh = HUD_DIGIT_H,
  ): void {
    for (let i = 0; i < text.length; i++) {
      const n = text.charCodeAt(i) - 48;
      if (n < 0 || n > 9) continue;
      this.ctx.drawImage(sheet, n * HUD_DIGIT_W, 0, HUD_DIGIT_W, HUD_DIGIT_H, x + i * dw, y, dw, dh);
    }
  }

  drawDigit(digit: number, x: number, y: number, scale = 1): void {
    const [sx0, sx1] = STAGE_DIGIT_RUNS[digit] ?? STAGE_DIGIT_RUNS[0];
    const srcW = sx1 - sx0;
    const srcH = 43;
    this.ctx.drawImage(this.knocked(this.assets.ui.numbers), sx0, 0, srcW, srcH, x, y, srcW * scale, srcH * scale);
  }

  drawTitle(levelIndex: number, alpha: number, shake: { x: number; y: number }): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    const n = levelIndex + 1;
    const stageImg = this.assets.ui.stage;
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    const tensW = (STAGE_DIGIT_RUNS[tens][1] - STAGE_DIGIT_RUNS[tens][0]);
    const onesW = (STAGE_DIGIT_RUNS[ones][1] - STAGE_DIGIT_RUNS[ones][0]);
    const total = 168 + tensW + 4 + onesW;
    const x = Math.round((STAGE_W - total) / 2) + shake.x;
    const y = 168 + shake.y;
    ctx.drawImage(this.knocked(stageImg), x, y);
    this.drawDigit(tens, x + 164, y);
    this.drawDigit(ones, x + 164 + tensW + 4, y);
    ctx.restore();
  }

  drawLogo(frame: number, x: number, y: number, glitch = 0): void {
    const img = this.assets.ui.logo[Math.max(0, Math.min(5, frame))];
    this.ctx.drawImage(this.knocked(img), x + glitch, y);
  }

  drawMenuButtons(
    selected: number,
    originY: number,
    hover: number | null,
    muted: boolean,
    canResume: boolean,
  ): void {
    const labels = ["Start New Game", "Resume Game", "Load Stage", "Toggle Sound", "Credits"];
    labels.forEach((label, i) => {
      const y = originY + i * MENU_GAP;
      const active = i === selected || i === hover;
      const dim = i === 1 && !canResume;
      this.ctx.save();
      this.ctx.globalAlpha = dim ? 0.32 : 1;
      if (active && !dim) this.drawUiText(">", MENU_X - 16, y + 16, { size: 15, glow: true });
      this.drawUiText(label, MENU_X + 4, y + 16, { size: 15, glow: true });
      if (i === 3) this.drawUiText(muted ? "Off" : "On", MENU_X + 172, y + 16, { size: 15, glow: true });
      this.ctx.restore();
    });
  }

  drawSpinBlock(frame: number, x: number, y: number): void {
    const frames = this.assets.block.spin;
    const img = frames[Math.max(0, Math.min(frames.length - 1, frame))];
    const scale = 0.92;
    this.ctx.save();
    const gx = x + 48;
    const gy = y + 72;
    const glow = this.ctx.createRadialGradient(gx, gy, 8, gx, gy, 110);
    glow.addColorStop(0, "rgba(255, 110, 30, 0.55)");
    glow.addColorStop(0.45, "rgba(180, 50, 10, 0.22)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(gx, gy, 110, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowColor = "#c05018";
    this.ctx.shadowBlur = 26;
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
    ctx.font = "16px Trebuchet MS, Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Would you like to view the instructions?", STAGE_W / 2, 178);
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
    const card = this.assets.splash.author;
    ctx.drawImage(card, (STAGE_W - card.width) / 2, (STAGE_H - card.height) / 2 - 10);
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
    const label = this.assets.ui.typePasscode;
    ctx.drawImage(this.knocked(label), (STAGE_W - label.width) / 2, 198);
    const dw = 18;
    const dh = 20;
    const startX = STAGE_W / 2 - (6 * dw) / 2;
    const digits = code.padEnd(6, " ").split("");
    digits.forEach((ch, i) => {
      const x = startX + i * dw;
      if (ch !== " ") this.drawSpriteDigits(this.assets.ui.loadDigits, ch, x, 228, dw, dh);
      else {
        ctx.fillStyle = "#fff4d6";
        ctx.font = "22px Courier New, monospace";
        ctx.textAlign = "center";
        ctx.fillText("_", x + dw / 2, 248);
      }
      if (i === cursor) {
        ctx.fillStyle = "#ffb060";
        ctx.font = "14px Trebuchet MS, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("^", x + dw / 2, 270);
      }
    });
    ctx.drawImage(this.knocked(this.assets.ui.enter), STAGE_W / 2 - 40, 286);
    ctx.drawImage(this.knocked(this.assets.ui.backMenu), 24, STAGE_H - 36);
    if (invalid) this.drawUiText("INVALID CODE", STAGE_W / 2, 338, { size: 14, glow: true, align: "center", color: "#ff6a55" });
    ctx.restore();
  }

  drawTutorial(slide: number, offsetY: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    const text = this.assets.tutorialText[slide];
    const art = this.assets.tutorial[slide];
    ctx.drawImage(text, 8, 8 + offsetY, 360, 168);
    ctx.drawImage(art, 360, 18 + offsetY, 175, 171);
    ctx.drawImage(this.assets.ui.prev, 24, STAGE_H - 40);
    if (slide < 8) ctx.drawImage(this.assets.ui.next, STAGE_W - 150, STAGE_H - 40);
    else ctx.drawImage(this.assets.ui.start, STAGE_W - 150, STAGE_H - 40);
    ctx.drawImage(this.assets.ui.skip, STAGE_W - 190, 8);
    ctx.restore();
  }

  hitTutorialNav(mx: number, my: number): "back" | "next" | "skip" | null {
    if (my < 40 && mx > STAGE_W - 200) return "skip";
    if (my < STAGE_H - 48) return null;
    if (mx < 160) return "back";
    if (mx > STAGE_W - 170) return "next";
    return null;
  }

  drawPause(selected: number, time: string, stage: number, attempts: number, muted: boolean): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    this.drawMenuTab();
    ctx.fillStyle = "#000";
    ctx.fillRect(28, 138, 236, 128);
    ctx.fillRect(300, 154, 220, 100);
    const opts = ["Return to Game", "Toggle Sound", "Quit to Menu"];
    opts.forEach((label, i) => {
      const y = 178 + i * 32;
      const active = i === selected;
      if (active) this.drawUiText(">", 36, y, { size: 15, glow: true });
      this.drawUiText(label, 56, y, { size: 15, glow: true });
      if (i === 1) this.drawUiText(muted ? "Off" : "On", 210, y, { size: 15, glow: true });
    });
    this.drawUiText("Time:", 318, 186, { size: 14, glow: true });
    this.drawUiText("Stage:", 318, 210, { size: 14, glow: true });
    this.drawUiText("Attempts:", 318, 234, { size: 14, glow: true });
    this.drawUiText(time, 504, 186, { size: 14, glow: true, align: "right" });
    this.drawUiText(String(stage + 1).padStart(2, "0"), 504, 210, { size: 14, glow: true, align: "right" });
    this.drawUiText(String(attempts), 504, 234, { size: 14, glow: true, align: "right" });
    ctx.restore();
  }

  drawComplete(moves: number, time: string, fails: number): void {
    const ctx = this.ctx;
    this.drawBg("menu");
    ctx.drawImage(this.assets.ui.congrats, 24, 70, 501, 43);
    this.drawUiText("You completed the 33 stages of Bloxorz!", STAGE_W / 2, 150, { size: 14, glow: true, align: "center" });
    this.drawUiText("Moves Taken:", STAGE_W / 2 + 20, 200, { size: 14, glow: true, align: "right" });
    this.drawUiText("Time Taken:", STAGE_W / 2 + 20, 224, { size: 14, glow: true, align: "right" });
    this.drawUiText("Failed Attempts:", STAGE_W / 2 + 20, 248, { size: 14, glow: true, align: "right" });
    this.drawUiText(String(moves), STAGE_W / 2 + 32, 200, { size: 14, glow: true });
    this.drawUiText(time, STAGE_W / 2 + 32, 224, { size: 14, glow: true });
    this.drawUiText(String(fails), STAGE_W / 2 + 32, 248, { size: 14, glow: true });
    this.drawUiText("Press Enter or click to return to the menu", STAGE_W / 2, 310, { size: 13, glow: true, align: "center", color: "#ffb060" });
  }

  menuHitLogoArea(): void {
    /* layout helper kept for hit testing in main */
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
