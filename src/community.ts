import { assetUrl } from "./assets";
import { decodeLevel, encodeLevel, type SavedStage } from "./customLevels";
import type { LevelDef } from "./levels";

const GITHUB_JSON =
  "https://raw.githubusercontent.com/masterwebx/web-bloxorz/main/public/community/stages.json";

export interface CommunityFile {
  stages?: CommunityStage[];
}

export interface CommunityStage {
  name: string;
  author: string;
  code?: string;
  tiles?: string[];
  spawn?: [number, number];
  switches?: LevelDef["switches"];
  splits?: LevelDef["splits"];
}

export function communityToSaved(row: CommunityStage): SavedStage | null {
  if (row.code) {
    const def = decodeLevel(row.code);
    if (!def) return null;
    return {
      name: row.name || "Community Stage",
      author: row.author || "Community",
      code: row.code,
      def,
      source: "downloaded",
    };
  }
  if (!row.tiles || row.tiles.length !== 10 || !row.spawn) return null;
  const def: LevelDef = {
    id: "custom",
    code: "000000",
    tiles: row.tiles.map((r) => (r + "               ").slice(0, 15)),
    spawn: row.spawn,
    switches: row.switches ?? [],
    splits: row.splits ?? [],
  };
  return {
    name: row.name || "Community Stage",
    author: row.author || "Community",
    code: encodeLevel(def),
    def,
    source: "downloaded",
  };
}

export async function fetchOnlineStages(): Promise<SavedStage[]> {
  const urls = [GITHUB_JSON, assetUrl("community/stages.json")];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as CommunityFile;
      const rows = (data.stages ?? []).map(communityToSaved).filter((s): s is SavedStage => !!s);
      if (rows.length) return rows;
    } catch {
      /* try next source */
    }
  }
  return [];
}
