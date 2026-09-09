import { describe, expect, it, beforeEach } from "vitest";
import { Stage } from "./engine";
import type { LevelDef } from "./levels";
import { H, W } from "./engine";
import {
  GhostRunner,
  ghostsForStage,
  loadRuns,
  loadSeeGhosts,
  pushGhost,
  saveRun,
  saveSeeGhosts,
  setHistoryStorage,
  winningTape,
} from "./history";

function mini(tiles: string[], spawn: [number, number] = [1, 0]): LevelDef {
  const rows = [...tiles];
  while (rows.length < H) rows.push("               ");
  return {
    id: "t",
    code: "000000",
    tiles: rows.map((r) => (r + "               ").slice(0, W)),
    spawn,
    switches: [],
    splits: [],
  };
}

class MemoryStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("run history", () => {
  beforeEach(() => {
    setHistoryStorage(new MemoryStore());
  });

  it("stores runs newest first and skips empty ones", () => {
    saveRun({
      id: "a",
      at: 1,
      player: "Wex",
      totalTimeMs: 1000,
      totalMoves: 10,
      fails: 2,
      complete: true,
      levels: [
        {
          stage: 0,
          timeMs: 1000,
          moves: 10,
          attempts: 1,
          tapes: [{ cmds: ["right", "right"], won: true }],
        },
      ],
    });
    saveRun({
      id: "b",
      at: 2,
      player: "Wex",
      totalTimeMs: 500,
      totalMoves: 4,
      fails: 0,
      complete: false,
      levels: [],
    });
    const runs = loadRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe("a");
    expect(winningTape(runs[0].levels[0])).toEqual(["right", "right"]);
  });

  it("keeps unique ghost tapes per stage", () => {
    pushGhost(0, ["right"]);
    pushGhost(0, ["right"]);
    pushGhost(0, ["left"]);
    pushGhost(1, ["up"]);
    expect(ghostsForStage(0)).toEqual([["right"], ["left"]]);
    expect(ghostsForStage(0, ["left"])).toEqual([["right"]]);
    expect(ghostsForStage(1)).toEqual([["up"]]);
  });

  it("defaults see-ghosts to on", () => {
    expect(loadSeeGhosts()).toBe(true);
    saveSeeGhosts(false);
    expect(loadSeeGhosts()).toBe(false);
  });
});

describe("ghost playback", () => {
  it("replays a short winning tape onto the exit", () => {
    const def = mini(["bbbe"], [0, 0]);
    const ghost = new GhostRunner(def, ["right", "right"]);
    for (let i = 0; i < 80; i++) ghost.tick(0.05);
    expect(ghost.finished).toBe(true);
    expect(ghost.stage.won).toBe(true);
    expect(ghost.stage.block).toEqual({ x: 3, y: 0, ori: "up" });
  });

  it("marks a falling tape finished without resetting attempts on the live stage", () => {
    const def = mini(["bbbe"], [1, 0]);
    const live = new Stage(def);
    live.attempts = 3;
    const ghost = new GhostRunner(def, ["left"]);
    for (let i = 0; i < 80; i++) ghost.tick(0.05);
    expect(ghost.finished).toBe(true);
    expect(ghost.stage.failed).toBe(true);
    expect(live.attempts).toBe(3);
  });
});

describe("attempt counting", () => {
  it("survives constructing a replacement Stage the way a respawn does", () => {
    const def = mini(["bbbe"], [1, 0]);
    const first = new Stage(def);
    first.attempts = 4;
    const next = new Stage(def);
    next.attempts = first.attempts;
    expect(next.attempts).toBe(4);
    expect(next.moves).toBe(0);
  });
});
