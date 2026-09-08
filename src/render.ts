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
const TILE_OX = -2;
const TILE_OY = -6;
const GROUND = 0.04;
const MENU_X = 42;
export const MENU_Y = 156;
export const MENU_GAP = 22;
export const MENU_COUNT = 7;
export const PAUSE_COUNT = 4;
export const LIST_Y0 = 148;
export const LIST_GAP = 22;
export const LIST_MAX = 9;
const SETTINGS_Y = 152;
const SETTINGS_GAP = 17;
const UI_FONT = "Orbitron, sans-serif";

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
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00001", "00001", "00001", "00001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "01010", "00100", "01010", "01010", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
};

function ease(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, t)) * Math.PI);
}

function easeOutBack(t: number): number {
  const c = 1.12;
  const p = t - 1;
  return 1 + c * p * p * p + (c - 1) * p * p;
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

function boxFor(block: BlockState, cube = false): { x: number; y: number; z: number; w: number; d: number; h: number } {
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
  if (dir === "right") return { origin: [b.x + b.w, b.y, z], axis: [0, 1, 0], angle: Math.PI / 2 };
  if (dir === "left") return { origin: [b.x, b.y, z], axis: [0, 1, 0], angle: -Math.PI / 2 };
  if (dir === "down") return { origin: [b.x, b.y + b.d, z], axis: [1, 0, 0], angle: -Math.PI / 2 };
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

function sampleBilinear(img: ImageData, x: number, y: number): [number, number, number, number] {
  const w = img.width;
  const h = img.height;
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(w - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(h - 1, y0 + 1));
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const at = (ix: number, iy: number): [number, number, number, number] => {
    const i = (iy * w + ix) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
  };
  const a = at(x0, y0);
  const b = at(x1, y0);
  const c = at(x0, y1);
  const d = at(x1, y1);
  const mix = (p: number[], q: number[], t: number) => p.map((v, i) => p[i] + (q[i] - v) * t);
  const top = mix(a, b, fx);
  const bot = mix(c, d, fx);
  const out = mix(top, bot, fy);
  return [out[0], out[1], out[2], out[3]];
}

function insetQuad(
  pts: { x: number; y: number }[],
  t: number,
): { x: number; y: number }[] {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  return pts.map((p) => ({ x: p.x + (cx - p.x) * t, y: p.y + (cy - p.y) * t }));
}

function unprojectQuad(
  src: HTMLCanvasElement,
  quad: { x: number; y: number }[],
  tw: number,
  th: number,
): HTMLCanvasElement {
  const g = src.getContext("2d")!;
  const img = g.getImageData(0, 0, src.width, src.height);
  const q = insetQuad(quad, 0.1);
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const out = c.getContext("2d")!;
  const dst = out.createImageData(tw, th);
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let v = 0; v < th; v++) {
    const tv = (v + 0.5) / th;
    for (let u = 0; u < tw; u++) {
      const tu = (u + 0.5) / tw;
      const x =
        (1 - tv) * ((1 - tu) * q[0].x + tu * q[1].x) + tv * ((1 - tu) * q[3].x + tu * q[2].x);
      const y =
        (1 - tv) * ((1 - tu) * q[0].y + tu * q[1].y) + tv * ((1 - tu) * q[3].y + tu * q[2].y);
      const px = sampleBilinear(img, x, y);
      const i = (v * tw + u) * 4;
      if (px[3] > 16 && px[0] + px[1] + px[2] > 30) {
        dst.data[i] = px[0];
        dst.data[i + 1] = px[1];
        dst.data[i + 2] = px[2];
        dst.data[i + 3] = 255;
        sr += px[0];
        sg += px[1];
        sb += px[2];
        n++;
      }
    }
  }
  const ar = n ? Math.round(sr / n) : 118;
  const ag = n ? Math.round(sg / n) : 82;
  const ab = n ? Math.round(sb / n) : 70;
  for (let i = 0; i < dst.data.length; i += 4) {
    if (dst.data[i + 3] < 16) {
      dst.data[i] = ar;
      dst.data[i + 1] = ag;
      dst.data[i + 2] = ab;
      dst.data[i + 3] = 255;
    }
  }
  out.putImageData(dst, 0, 0);
  return c;
}

function spriteOffset(
  box: { w: number; d: number; h: number },
  tipX: number,
  tipY: number,
): { x: number; y: number } {
  const pts = boxCorners({ x: 0, y: 0, z: GROUND, ...box });
  let tip = project(pts[0][0], pts[0][1], pts[0][2]);
  for (const p of pts) {
    const s = project(p[0], p[1], p[2]);
    if (s.y < tip.y) tip = s;
  }
  return { x: tipX - tip.x, y: tipY - tip.y };
}

function faceQuad(
  box: { w: number; d: number; h: number },
  face: number[],
  ox: number,
  oy: number,
): { x: number; y: number }[] {
  const pts = boxCorners({ x: 0, y: 0, z: GROUND, ...box });
  return face.map((i) => {
    const s = project(pts[i][0], pts[i][1], pts[i][2]);
    return { x: s.x + ox, y: s.y + oy };
  });
}

function isFloorFace(corners: [number, number, number][], idx: number[]): boolean {
  const pts = idx.map((i) => corners[i]);
  const avgZ = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
  const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
  const e2 = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1], pts[3][2] - pts[0][2]];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  return avgZ < GROUND + 0.18 && nz < 0;
}

/** Original stage art already paints Passcode/Moves into the bitmap. Wipe that under-layer. */
function scrubBakedHud(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = STAGE_W;
  c.height = STAGE_H;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, STAGE_W, STAGE_H);
  const data = g.getImageData(0, 0, STAGE_W, STAGE_H);
  const px = data.data;
  const x0 = Math.floor((248 * STAGE_W) / img.width);
  const x1 = STAGE_W;
  const y0 = 0;
  const y1 = Math.min(STAGE_H, Math.ceil((92 * STAGE_H) / img.height));
  const sampleX = Math.max(0, Math.floor((168 * STAGE_W) / img.width));
  for (let y = y0; y < y1; y++) {
    const si = (y * STAGE_W + sampleX) * 4;
    const r = px[si];
    const gv = px[si + 1];
    const b = px[si + 2];
    const a = px[si + 3];
    for (let x = x0; x < x1; x++) {
      const i = (y * STAGE_W + x) * 4;
      px[i] = r;
      px[i + 1] = gv;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
  g.putImageData(data, 0, 0);
  return c;
}

export function listStart(count: number, selected: number, max = LIST_MAX): number {
  if (count <= max) return 0;
  return Math.max(0, Math.min(count - max, selected - Math.floor(max / 2)));
}

function settledCorners(state: BlockState, cube: boolean): [number, number, number][] {
  if (cube || state.ori === "up") return boxCorners(boxFor(state, cube));
  if (state.ori === "forward") {
    const from: BlockState = { x: state.x, y: state.y - 1, ori: "up" };
    return boxCorners(boxFor(from, false), { ...rollSpec(from, "down", false), angle: -Math.PI / 2 });
  }
  const from: BlockState = { x: state.x - 1, y: state.y, ori: "up" };
  return boxCorners(boxFor(from, false), { ...rollSpec(from, "right", false), angle: Math.PI / 2 });
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  cam: Camera = { x: 0, y: 0 };
  private knockCache = new Map<HTMLImageElement, HTMLCanvasElement>();
  private rustEnd: HTMLCanvasElement;
  private rustSide: HTMLCanvasElement;
  private levelBg: HTMLCanvasElement;
  private hudSky = "rgb(196, 158, 104)";

  constructor(
    canvas: HTMLCanvasElement,
    private assets: Assets,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = true;
    const up = this.knocked(assets.block.up);
    const flat = this.knocked(assets.block.forward);
    const stand = { w: 1, d: 1, h: 2 };
    const lie = { w: 1, d: 2, h: 1 };
    const so = spriteOffset(stand, 110, 36);
    const fo = spriteOffset(lie, 89, 32);
    this.rustEnd = unprojectQuad(up, faceQuad(stand, FACES[0], so.x, so.y), 96, 96);
    this.rustSide = unprojectQuad(flat, faceQuad(lie, FACES[0], fo.x, fo.y), 96, 192);
    this.levelBg = scrubBakedHud(assets.ui.levelBg);
    const sample = this.levelBg.getContext("2d")!.getImageData(168, 10, 1, 1).data;
    this.hudSky = `rgb(${sample[0]}, ${sample[1]}, ${sample[2]})`;
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
    this.ctx.filter = "none";
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = "transparent";
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    this.ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  }

  drawBg(kind: "menu" | "level"): void {
    const img = kind === "menu" ? this.assets.ui.menuBg : this.levelBg;
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
    let extraZ = 0;
    let alpha = 1;
    let roll: { origin: [number, number, number]; axis: [number, number, number]; angle: number } | undefined;
    let boxState = state;

    if (anim?.kind === "drop") {
      const t = ease(anim.t / anim.dur);
      extraZ = (1 - t) * 6.7;
      boxState = anim.to;
    } else if (anim?.kind === "splitdrop") {
      const t = ease(anim.t / anim.dur);
      extraZ = (1 - t) * 5.6;
      cube = true;
      boxState = which === 0
        ? { x: anim.from.x, y: anim.from.y, ori: "up" }
        : { x: anim.to2!.x, y: anim.to2!.y, ori: "up" };
    } else if (anim?.kind === "roll" && anim.dir) {
      const t = ease(anim.t / anim.dur);
      boxState = anim.from;
      const spec = rollSpec(anim.from, anim.dir, cube);
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

    let corners: [number, number, number][];
    if (roll) {
      const base = settledCorners(boxState, cube);
      corners = base.map((p) => rotateAround(p, roll.origin, roll.axis, roll.angle));
    } else {
      corners = settledCorners(boxState, cube);
    }
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

    this.drawBlockShadow(
      boxState,
      cube,
      anim?.kind === "fall" || anim?.kind === "sink" ? alpha * 0.25 : 0.38,
    );

    const shade = [1, 0.55, 0.82, 0.66, 0.74, 0.88];

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const f of faces) {
      if (f.cross <= 0) continue;
      if (extraZ >= -0.08 && isFloorFace(corners, FACES[f.fi])) continue;
      const tex = cube || f.fi === 0 || f.fi === 1 ? this.rustEnd : this.rustSide;
      this.paintFace(tex, f.pts, shade[f.fi]);
    }
    ctx.restore();
  }

  private paintFace(
    tex: HTMLCanvasElement,
    pts: { x: number; y: number }[],
    shade: number,
  ): void {
    const ctx = this.ctx;
    const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
    const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
    const grow = pts.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / len) * 0.55, y: p.y + (dy / len) * 0.55 };
    });
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(grow[0].x, grow[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(grow[i].x, grow[i].y);
    ctx.closePath();
    ctx.fillStyle = `rgb(${Math.round(118 * shade)},${Math.round(82 * shade)},${Math.round(70 * shade)})`;
    ctx.fill();
    ctx.clip();
    const p0 = grow[0];
    const p1 = grow[1];
    const p3 = grow[3];
    ctx.setTransform(
      (p1.x - p0.x) / tex.width,
      (p1.y - p0.y) / tex.width,
      (p3.x - p0.x) / tex.height,
      (p3.y - p0.y) / tex.height,
      p0.x,
      p0.y,
    );
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tex, 0, 0);
    ctx.fillStyle = `rgba(16, 8, 4, ${(1 - shade) * 0.32})`;
    ctx.fillRect(0, 0, tex.width, tex.height);
    ctx.restore();
  }

  private drawBlockShadow(state: BlockState, cube: boolean, alpha: number): void {
    const cells = cube ? [{ x: state.x, y: state.y }] : occupied(state);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
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
    ctx.restore();
  }

  private drawUiText(
    text: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      color?: string;
      glow?: boolean;
      shadow?: boolean;
      align?: CanvasTextAlign;
      weight?: string;
      hot?: boolean;
    } = {},
  ): void {
    const ctx = this.ctx;
    const hot = !!opts.hot;
    const size = (opts.size ?? 15) * (hot ? 1.08 : 1);
    ctx.save();
    ctx.font = `${opts.weight ?? "700"} ${size}px ${UI_FONT}`;
    ctx.textAlign = opts.align ?? "left";
    ctx.textBaseline = "alphabetic";
    ctx.filter = "none";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const glowOn = opts.glow !== false;
    if (hot) {
      ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
      ctx.shadowBlur = 22;
    } else if (glowOn) {
      ctx.shadowColor = "rgba(255, 162, 0, 0.62)";
      ctx.shadowBlur = 20;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
    const tx = Math.round(x);
    const ty = Math.round(y);
    ctx.fillStyle = opts.color ?? "#111";
    ctx.fillText(text, tx, ty);
    ctx.restore();
  }

  drawHud(code: string, moves: number, tab = "Menu", tabHot = false): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.hudSky;
    ctx.fillRect(252, 0, STAGE_W - 252, 48);
    ctx.restore();
    this.drawMenuTab(tab, tabHot);
    this.drawUiText(`Passcode: ${code}`, 536, 18, { size: 13, align: "right", weight: "500", color: "#111" });
    this.drawUiText(`Moves: ${String(moves).padStart(6, "0")}`, 536, 36, { size: 13, align: "right", weight: "500", color: "#111" });
  }

  drawMenuTab(label = "Menu", hot = false): void {
    this.drawUiText(label, 14, 20, { size: 13, weight: "500", color: "#111", hot });
  }

  hitMenuTab(mx: number, my: number, wide = false): boolean {
    return mx >= 8 && mx <= (wide ? 168 : 70) && my >= 6 && my <= 28;
  }

  drawTitle(title: string, alpha: number, shake: { x: number; y: number }, subtitle?: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    this.drawUiText(title, STAGE_W / 2 + shake.x, subtitle ? 200 + shake.y : 214 + shake.y, {
      size: title.length > 16 ? 26 : 36,
      align: "center",
      color: "#fff8e8",
    });
    if (subtitle) {
      this.drawUiText(subtitle, STAGE_W / 2 + shake.x, 248 + shake.y, {
        size: 16,
        align: "center",
        weight: "500",
        color: "#ffc37a",
      });
    }
    ctx.restore();
  }

  logoWidth(text: string): number {
    const letters = text || "BLOXORZ";
    const pitch = Math.min(5.5, 300 / (letters.length * 6));
    return letters.length * 6 * pitch;
  }

  drawLogo(x: number, y: number, text = "BLOXORZ", neonR = 1, neonZ = 1, glitch = 0): number {
    const ctx = this.ctx;
    const letters = text.toUpperCase();
    const pitch = Math.min(5.5, 300 / (Math.max(1, letters.length) * 6));
    const radius = 2.25;
    ctx.save();
    ctx.translate(x + glitch, y);
    letters.split("").forEach((ch, li) => {
      const glyph = BILLBOARD[ch];
      if (!glyph) return;
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
    return letters.length * 6 * pitch;
  }

  drawMenuButtons(
    selected: number,
    originY: number,
    hover: number | null,
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
      const hot = !dim && (hover === i || (hover === null && selected === i));
      this.ctx.save();
      this.ctx.globalAlpha = dim ? 0.32 : 1;
      if (selected === i && !dim) this.drawUiText(">", MENU_X - 16, y + 16, { size: 14, hot, color: "#111" });
      this.drawUiText(label, MENU_X + 4, y + 16, { size: 14, hot, color: "#111" });
      if (i === 5) this.drawUiText(muted ? "Off" : "On", MENU_X + 172, y + 16, { size: 14, hot, color: "#111" });
      this.ctx.restore();
    });
  }

  drawSpinningBox(t: number, x: number, y: number): void {
    const prev = this.cam;
    const mid = project(0.5, 0.5, 1);
    this.cam = { x: x - mid.x, y: y - mid.y };
    const origin: [number, number, number] = [0.5, 0.5, 1];
    const len = Math.hypot(0.28, 1, 0.18) || 1;
    const axis: [number, number, number] = [0.28 / len, 1 / len, 0.18 / len];
    const angle = t * Math.PI * 2 * 2.4;
    const box = { x: 0, y: 0, z: 0, w: 1, d: 1, h: 2 };
    const corners = boxCorners(box).map((p) => rotateAround(p, origin, axis, angle));
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
    const shade = [1, 0.55, 0.82, 0.66, 0.74, 0.88];
    this.ctx.save();
    for (const f of faces) {
      if (f.cross <= 0) continue;
      const tex = f.fi === 0 || f.fi === 1 ? this.rustEnd : this.rustSide;
      this.paintFace(tex, f.pts, shade[f.fi]);
    }
    this.ctx.restore();
    this.cam = prev;
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

  drawAskInstructions(selected: number, hover: number | null): void {
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
      const hot = hover === i || (hover === null && selected === i);
      this.drawUiText(i === selected ? `> ${label}` : `  ${label}`, 210, y, {
        size: 15,
        color: "#fff4d6",
        hot,
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
        color: "#fff8e8",
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

  drawLoad(code: string, cursor: number, invalid: boolean, hover: "enter" | "back" | null): void {
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
    this.drawUiText("Enter", STAGE_W / 2, 304, { size: 14, align: "center", hot: hover === "enter" });
    this.drawUiText("Back", 36, STAGE_H - 18, { size: 13, hot: hover === "back" });
    if (invalid) this.drawUiText("INVALID CODE", STAGE_W / 2, 338, { size: 14, glow: true, align: "center", color: "#ff6a55" });
    ctx.restore();
  }

  hitLoad(mx: number, my: number): "enter" | "back" | null {
    if (my > STAGE_H - 40 && mx < 120) return "back";
    if (my >= 286 && my <= 318 && mx > 220 && mx < 330) return "enter";
    return null;
  }

  drawTutorial(slide: number, offsetY: number, hover: "back" | "next" | "skip" | null): void {
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
    this.drawUiText("Skip", STAGE_W - 70, 24, { size: 13, align: "right", color: "#fff8e8", hot: hover === "skip" });
    this.drawUiText("Back", 40, STAGE_H - 18, { size: 13, color: "#fff8e8", hot: hover === "back" });
    this.drawUiText(slide < 8 ? "Next" : "Start", STAGE_W - 40, STAGE_H - 18, {
      size: 13,
      align: "right",
      color: "#fff8e8",
      hot: hover === "next",
    });
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
    hover: number | null,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.28 * slide})`;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    this.drawMenuTab("Menu", hover === -1);
    const e = 1 - Math.pow(1 - Math.min(1, slide), 3);
    const leftX = -240 + (28 + 240) * e;
    const rightX = 560 + (300 - 560) * e;
    ctx.fillStyle = "#000";
    ctx.fillRect(leftX, 128, 236, 168);
    ctx.fillRect(rightX, 154, 220, 100);
    const light = "#fff8e8";
    const opts = ["Return to Game", "Restart Level", "Toggle Sound", "Quit to Menu"];
    opts.forEach((label, i) => {
      const y = 158 + i * 32;
      const hot = hover === i || (hover === null && selected === i);
      if (i === selected) this.drawUiText(">", leftX + 8, y, { size: 14, color: light, hot });
      this.drawUiText(label, leftX + 28, y, { size: 14, color: light, hot });
      if (i === 2) this.drawUiText(muted ? "Off" : "On", leftX + 182, y, { size: 14, color: light, hot });
    });
    this.drawUiText("Time:", rightX + 18, 186, { size: 14, color: light });
    this.drawUiText("Stage:", rightX + 18, 210, { size: 14, color: light });
    this.drawUiText("Attempts:", rightX + 18, 234, { size: 14, color: light });
    this.drawUiText(time, rightX + 204, 186, { size: 14, align: "right", color: light });
    this.drawUiText(String(stage + 1).padStart(2, "0"), rightX + 204, 210, { size: 14, align: "right", color: light });
    this.drawUiText(String(attempts), rightX + 204, 234, { size: 14, align: "right", color: light });
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
    hover: number | null,
  ): void {
    this.drawUiText("Settings", 42, 130, { size: 18 });
    rows.forEach((row, i) => {
      const y = SETTINGS_Y + i * SETTINGS_GAP;
      const hot = hover === i || (hover === null && selected === i);
      if (i === selected) this.drawUiText(">", 28, y, { size: 13, hot });
      this.drawUiText(row.label, 48, y, { size: 13, hot });
      this.drawUiText(row.value, 520, y, { size: 13, align: "right", hot });
    });
    this.drawUiText("Left / Right change values. Enter rebinds a key.", 42, 368, {
      size: 11,
      weight: "500",
    });
    this.drawUiText(listen ?? "Shift+Enter or click right to rebind a button. Esc back.", 42, 386, {
      size: 11,
      weight: "500",
    });
  }

  drawCreatorHub(title: string, labels: string[], selected: number, hover: number | null): void {
    this.drawUiText(title, 42, 140, { size: 18 });
    labels.forEach((label, i) => {
      const y = 180 + i * 28;
      const hot = hover === i || (hover === null && selected === i);
      if (i === selected) this.drawUiText(">", 28, y, { size: 15, hot });
      this.drawUiText(label, 48, y, { size: 15, hot });
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
    cursor: { x: number; y: number },
    headerHot: "test" | "back" | null,
    toolHover: number | null = null,
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
    this.drawUiText(shown, 20, 22, { size: 13, color: nameFocus ? "#fff4d6" : "#111", hot: nameFocus });
    this.drawUiText("Test", 430, 22, { size: 13, hot: headerHot === "test" });
    this.drawUiText("Back", 510, 22, { size: 13, hot: headerHot === "back" });
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
        if (cursor.x === x && cursor.y === y) {
          this.ctx.strokeStyle = "#fff";
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(px + 0.5, py + 0.5, cs - 2, cs - 2);
          this.ctx.lineWidth = 1;
        }
      }
    }
    tools.forEach((t, i) => {
      const x = 410;
      const y = 48 + i * 22;
      const hot = t === tool || toolHover === i;
      if (t === tool) this.drawUiText(">", x - 14, y, { size: 12, hot });
      this.drawUiText(t, x, y, { size: 12, hot });
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

  hitCreatorHub(mx: number, my: number, count: number): number | null {
    if (mx < 24 || mx > 420) return null;
    const i = Math.floor((my - 162) / 28);
    if (i < 0 || i >= count) return null;
    return i;
  }

  drawNameEntry(name: string, brand: string): void {
    this.drawUiText("What should we call you?", 42, 150, { size: 18 });
    this.drawUiText("This name is saved on stages you create.", 42, 178, { size: 13, weight: "500" });
    this.drawUiText(`${name}_`, 42, 230, { size: 22 });
    this.drawUiText(`The game will be ${brand}`, 42, 270, { size: 14, weight: "500" });
    this.drawUiText("Type your name, then press Enter", 42, 360, { size: 13, weight: "500" });
  }

  drawStageList(
    title: string,
    rows: string[],
    selected: number,
    hover: number | null,
    hint: string,
    empty: string,
    backHot = false,
  ): void {
    this.drawUiText(title, 42, 128, { size: 18 });
    if (!rows.length) this.drawUiText(empty, 48, 176, { size: 13, weight: "500" });
    const start = listStart(rows.length, selected);
    rows.slice(start, start + LIST_MAX).forEach((n, i) => {
      const idx = start + i;
      const y = 160 + i * LIST_GAP;
      const hot = hover === idx || (hover === null && selected === idx);
      if (idx === selected) this.drawUiText(">", 28, y, { size: 13, hot });
      this.drawUiText(n, 48, y, { size: 13, hot });
    });
    this.drawUiText("Back", 42, 386, { size: 13, hot: backHot });
    this.drawUiText(hint, 140, 386, { size: 11, weight: "500" });
  }

  hitStageList(mx: number, my: number, count: number, selected: number): number | null {
    if (mx < 24 || mx > 520) return null;
    const start = listStart(count, selected);
    const i = Math.floor((my - LIST_Y0) / LIST_GAP);
    if (i < 0 || i >= LIST_MAX) return null;
    const idx = start + i;
    if (idx < 0 || idx >= count) return null;
    return idx;
  }

  hitListBack(mx: number, my: number): boolean {
    return my > STAGE_H - 28 && mx < 120;
  }

  drawEnterCode(paste: string, msg: string, hover: "play" | "back" | null): void {
    this.drawUiText("Enter Code", 42, 128, { size: 18 });
    this.drawUiText("Paste or type a BX1 share code.", 42, 160, { size: 13, weight: "500" });
    this.drawUiText(paste || "_", 42, 210, { size: 14, weight: "500" });
    this.drawUiText("Play", 48, 258, { size: 15, hot: hover === "play" });
    this.drawUiText("Back", 42, 386, { size: 13, hot: hover === "back" });
    this.drawUiText(msg, 42, 300, { size: 12, weight: "500", color: "#a04020" });
  }

  hitEnterCode(mx: number, my: number): "play" | "back" | null {
    if (this.hitListBack(mx, my)) return "back";
    if (my >= 240 && my <= 272 && mx >= 36 && mx < 160) return "play";
    return null;
  }

  drawPackEdit(
    name: string,
    rows: { label: string; on: boolean }[],
    selected: number,
    hover: number | null,
    nameHot: boolean,
    footerHot: "save" | "back" | null,
  ): void {
    this.drawUiText("Create Stage Pack", 42, 128, { size: 18 });
    this.drawUiText(`Pack name: ${name}_`, 42, 156, { size: 13, hot: nameHot });
    if (!rows.length) this.drawUiText("Save some stages first, then come back.", 48, 190, { size: 13, weight: "500" });
    const start = listStart(rows.length, selected, 8);
    rows.slice(start, start + 8).forEach((row, i) => {
      const idx = start + i;
      const y = 178 + i * 22;
      const hot = hover === idx || (hover === null && selected === idx);
      const mark = row.on ? "[x]" : "[ ]";
      if (idx === selected) this.drawUiText(">", 28, y, { size: 13, hot });
      this.drawUiText(`${mark} ${row.label}`, 48, y, { size: 13, hot });
    });
    this.drawUiText("Save Pack", 42, 364, { size: 13, hot: footerHot === "save" });
    this.drawUiText("Back", 42, 386, { size: 13, hot: footerHot === "back" });
    this.drawUiText("Enter toggles a stage. Start / S saves.", 160, 386, { size: 11, weight: "500" });
  }

  hitPackName(mx: number, my: number): boolean {
    return mx >= 24 && mx < 500 && my >= 140 && my <= 168;
  }

  hitPackList(mx: number, my: number, count: number, selected: number): number | null {
    if (mx < 24 || mx > 520) return null;
    const start = listStart(count, selected, 8);
    const i = Math.floor((my - 166) / 22);
    if (i < 0 || i >= 8) return null;
    const idx = start + i;
    if (idx < 0 || idx >= count) return null;
    return idx;
  }

  hitPackFooter(mx: number, my: number): "save" | "back" | null {
    if (my >= 348 && my <= 372 && mx >= 24 && mx < 160) return "save";
    if (this.hitListBack(mx, my)) return "back";
    return null;
  }

  hitSavePrompt(_mx: number, my: number): number | null {
    if (my >= 214 && my <= 240) return 0;
    if (my >= 244 && my <= 270) return 1;
    return null;
  }

  drawSavePrompt(code: string, msg: string, hover: number | null): void {
    this.drawUiText("Stage beaten — it can be saved.", 275, 160, { size: 16, glow: true, align: "center" });
    this.drawUiText(`Name: ${msg}_`, 275, 190, { size: 13, glow: true, align: "center" });
    this.drawUiText("Save & Copy Code", 275, 230, { size: 15, glow: true, align: "center", hot: hover === 0 });
    this.drawUiText("Keep Editing", 275, 258, { size: 15, glow: true, align: "center", hot: hover === 1 });
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
