import type { LevelDef } from "./levels";

const STORE = "bloxorz-custom-stages-v1";
const DOWNLOADED = "bloxorz-downloaded-stages-v1";
const PACKS = "bloxorz-stage-packs-v1";

export interface SavedStage {
  name: string;
  author: string;
  code: string;
  def: LevelDef;
  source?: "local" | "downloaded";
}

export interface StagePack {
  id: string;
  name: string;
  author: string;
  codes: string[];
}

export function emptyDraft(): LevelDef {
  const tiles = [
    "               ",
    "               ",
    "               ",
    "               ",
    "  bbbbbbbe    ",
    "               ",
    "               ",
    "               ",
    "               ",
    "               ",
  ];
  return {
    id: "custom",
    code: "000000",
    tiles,
    spawn: [2, 4],
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

function readList(key: string): SavedStage[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedStage[];
    return parsed.map((s) => ({
      ...s,
      author: s.author || "Unknown",
      source: s.source ?? (key === DOWNLOADED ? "downloaded" : "local"),
    }));
  } catch {
    return [];
  }
}

function writeList(key: string, all: SavedStage[]): void {
  localStorage.setItem(key, JSON.stringify(all.slice(0, 80)));
}

export function listSaved(): SavedStage[] {
  return readList(STORE);
}

export function listDownloaded(): SavedStage[] {
  return readList(DOWNLOADED);
}

export function listAllStages(): SavedStage[] {
  return [...listSaved(), ...listDownloaded()];
}

export function saveStage(stage: SavedStage): void {
  const key = stage.source === "downloaded" ? DOWNLOADED : STORE;
  const all = readList(key).filter((s) => s.code !== stage.code);
  all.unshift({ ...stage, source: stage.source ?? "local" });
  writeList(key, all);
}

export function deleteStage(code: string): void {
  writeList(STORE, listSaved().filter((s) => s.code !== code));
  writeList(DOWNLOADED, listDownloaded().filter((s) => s.code !== code));
}

export function findStage(code: string): SavedStage | undefined {
  return listAllStages().find((s) => s.code === code);
}

export function listPacks(): StagePack[] {
  try {
    const raw = localStorage.getItem(PACKS);
    if (!raw) return [];
    return JSON.parse(raw) as StagePack[];
  } catch {
    return [];
  }
}

export function savePack(pack: StagePack): void {
  const all = listPacks().filter((p) => p.id !== pack.id);
  all.unshift(pack);
  localStorage.setItem(PACKS, JSON.stringify(all.slice(0, 40)));
}

export function deletePack(id: string): void {
  localStorage.setItem(PACKS, JSON.stringify(listPacks().filter((p) => p.id !== id)));
}

export function packStages(pack: StagePack): SavedStage[] {
  return pack.codes.map((c) => findStage(c)).filter((s): s is SavedStage => !!s);
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
