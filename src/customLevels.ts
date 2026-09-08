import type { LevelDef } from "./levels";

const STORE = "bloxorz-custom-stages-v1";

export interface SavedStage {
  name: string;
  code: string;
  def: LevelDef;
}

export function emptyDraft(): LevelDef {
  const tiles = Array.from({ length: 10 }, () => "               ");
  return {
    id: "custom",
    code: "000000",
    tiles,
    spawn: [7, 5],
    switches: [],
    splits: [],
  };
}

export function setTile(def: LevelDef, x: number, y: number, ch: string): void {
  if (y < 0 || y >= 10 || x < 0 || x >= 15) return;
  const row = def.tiles[y].split("");
  row[x] = ch;
  def.tiles[y] = row.join("");
}

export function tileChar(def: LevelDef, x: number, y: number): string {
  return def.tiles[y]?.[x] ?? " ";
}

export function encodeLevel(def: LevelDef): string {
  const raw = JSON.stringify({ t: def.tiles, s: def.spawn, w: def.switches, p: def.splits });
  const b64 = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `BX1.${b64}`;
}

export function decodeLevel(code: string): LevelDef | null {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith("BX1.")) return null;
    let b64 = trimmed.slice(4).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const raw = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(raw) as { t: string[]; s: [number, number]; w: LevelDef["switches"]; p: LevelDef["splits"] };
    if (!Array.isArray(data.t) || data.t.length !== 10) return null;
    return {
      id: "custom",
      code: "000000",
      tiles: data.t.map((r) => (r + "               ").slice(0, 15)),
      spawn: data.s,
      switches: data.w ?? [],
      splits: data.p ?? [],
    };
  } catch {
    return null;
  }
}

export function listSaved(): SavedStage[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    return JSON.parse(raw) as SavedStage[];
  } catch {
    return [];
  }
}

export function saveStage(stage: SavedStage): void {
  const all = listSaved().filter((s) => s.code !== stage.code);
  all.unshift(stage);
  localStorage.setItem(STORE, JSON.stringify(all.slice(0, 40)));
}

export function deleteStage(code: string): void {
  localStorage.setItem(STORE, JSON.stringify(listSaved().filter((s) => s.code !== code)));
}

export function isPlayable(def: LevelDef): string | null {
  const exits = def.tiles.reduce((n, r) => n + [...r].filter((c) => c === "e").length, 0);
  const hasStone = def.tiles.some((r) => /[bshfvlrkq]/.test(r));
  if (exits === 0) return "Place an exit hole.";
  if (exits > 1) return "Only one exit is allowed.";
  if (!hasStone) return "Paint some tiles.";
  const [sx, sy] = def.spawn;
  const ch = tileChar(def, sx, sy);
  if (ch === " " || ch === "e") return "Spawn must sit on a solid tile.";
  return null;
}
