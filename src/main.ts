import { loadAssets, STAGE_H, STAGE_W } from "./assets";
import { SoundBank } from "./audio";
import {
  deletePack,
  deleteStage,
  emptyDraft,
  encodeLevel,
  encodeSeed,
  isPlayable,
  listAllStages,
  listDownloaded,
  listPacks,
  listSaved,
  packStages,
  parseShare,
  savePack,
  saveStage,
  stageId,
  type SavedStage,
  type StagePack,
} from "./customLevels";
import { checkBeatable, EDITOR_TOOLS, newPaintState, paintEditorCell, splitMarks, type BeatStatus, type EditorToolId } from "./editor";
import { fetchOnlineStages } from "./community";
import { LEVELS, Stage, levelByCode, type Dir } from "./engine";
import {
  GhostRunner,
  ghostsForStage,
  loadRuns,
  loadSeeGhosts,
  pushGhost,
  saveRun,
  saveSeeGhosts,
  winningTape,
  type LevelStat,
  type RunRecord,
  type TapeCmd,
} from "./history";
import { Input } from "./input";
import { Renderer, fitCamera, formatTime, MENU_COUNT, MENU_Y, PAUSE_COUNT } from "./render";
import {
  DIFFICULTIES,
  RUN_LENGTHS,
  dailySeed,
  difficultyLabel,
  generatePuzzle,
  generateRun,
  type Difficulty,
  type Puzzle,
} from "./generate";
import { ACTION_LABEL, brandName, isDevName, loadSettings, saveSettings, type Action, type Settings } from "./settings";
import { solveLevel } from "./solve";
import type { LevelDef } from "./levels";

type Screen =
  | "boot"
  | "author"
  | "nameEntry"
  | "menu"
  | "ask"
  | "load"
  | "credits"
  | "tutorial"
  | "title"
  | "play"
  | "pause"
  | "complete"
  | "history"
  | "settings"
  | "creatorHub"
  | "editor"
  | "editorSave"
  | "devMenu"
  | "puzzles";

type CreatorPage = "root" | "create" | "play" | "enterCode" | "offline" | "online" | "manage" | "packEdit";

type PlayMode = "campaign" | "custom" | "editor-test" | "replay" | "puzzle";
type PuzzlePage = "root" | "daily" | "seeded";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const touch = document.querySelector<HTMLElement>("#touch")!;

const sound = new SoundBank();
const settings: Settings = loadSettings();
sound.sfx = settings.sfx;
sound.music = settings.music;
const input = new Input(settings);

let renderer: Renderer;
let screen: Screen = "boot";
let menuIndex = 0;
let menuHover: number | null = null;
let loadCode = "";
let loadCursor = 0;
let loadInvalid = false;
let loadIndex = 0;
let tutorialSlide = 0;
let tutorialOffset = 0;
let pauseIndex = 0;
let pauseSlide = 0;
let levelIndex = 0;
let stage: Stage | null = null;
let titleT = 0;
let logoNeonR = 1;
let logoNeonZ = 1;
let glitchX = 0;
let sessionMoves = 0;
let sessionFails = 0;
let sessionStart = 0;
let sessionTimeMs = 0;
let runLevels: LevelStat[] = [];
let currentTape: TapeCmd[] = [];
let levelTapes: LevelStat["tapes"] = [];
let levelBeganAt = 0;
let completeShowStats = false;
let completeStatsIndex = 0;
let historyView: "list" | "detail" = "list";
let historyIndex = 0;
let historyRuns: RunRecord[] = [];
let historyRun: RunRecord | null = null;
let seeGhosts = loadSeeGhosts();
let replayCmds: TapeCmd[] = [];
let replayI = 0;
let replayStage = 0;
let ghosts: GhostRunner[] = [];
let historyId = "";
let feedingReplay = false;
let autoSolve = false;
let playBanner = "";
let beatStatus: BeatStatus = "wait";
let beatTimer: ReturnType<typeof setTimeout> | null = null;
let runFlushed = false;
let puzzlePage: PuzzlePage = "root";
let puzzleIndex = 0;
let puzzleDiff: Difficulty = "easy";
let puzzleLength = 1;
let puzzleSeed = "BLOX";
let puzzleSeedFocus = false;
let puzzleFocus: "seed" | "diff" | "length" | "play" = "diff";
let puzzleQueue: Puzzle[] = [];
let puzzleQueueIndex = 0;
let puzzleMsg = "";
let pendingResult: "ok" | "fail" | "win" | "split" | "assemble" | "scatter" | null = null;
let busy = false;
let splashT = 0;
let askIndex = 0;
let spinT = 0;
let resumeAt: number | null = null;
let playMode: PlayMode = "campaign";
let currentDef: LevelDef | null = null;
let currentTitle = "";
let currentAuthor = "";
let settingsIndex = 0;
let settingsNameFocus = false;
let settingsNameAtFocus = "";
let creatorIndex = 0;
let creatorPage: CreatorPage = "root";
let draft: LevelDef = emptyDraft();
let editorName = "My Stage";
let editorNameFocus = false;
let editorTool: EditorToolId = "stone";
let editorHint = "Arrows move the cursor. Confirm paints. [ ] cycle tools.";
let editorCursor = { x: 2, y: 4 };
let paintState = newPaintState();
let paintHeld = false;
let customIndex = 0;
let pasteBuf = "";
let customMsg = "";
let saveChoice = 0;
let saveMsg = "";
let shareCode = "";
let onlineStages: SavedStage[] = [];
let onlineStatus = "Loading community stages…";
let packDraft: StagePack = { id: "", name: "My Pack", author: "", codes: [] };
let packNameFocus = false;
let customQueue: SavedStage[] = [];
let customQueueIndex = 0;
let customOrigin: CreatorPage = "offline";
let nameDraft = "";
type ExtraHover = "enter" | "back" | "play" | "test" | "skip" | "next" | "prev" | "tab" | "dev" | "beat" | "save" | "name" | "win" | "close" | "stats" | "ghosts" | "seed" | null;
let extraHover: ExtraHover = null;

function now(): number {
  return performance.now();
}

function persist(): void {
  saveSettings(settings);
  sound.setMix(settings.sfx, settings.music);
  applyBrand();
}

function maybeDevUnlock(prev: string, next: string): void {
  if (!isDevName(prev) && isDevName(next)) sound.playDevUnlock();
}

function beginNameEdit(): void {
  settingsNameAtFocus = settings.playerName;
  settingsNameFocus = true;
}

function endNameEdit(): void {
  settingsNameFocus = false;
  persist();
  maybeDevUnlock(settingsNameAtFocus, settings.playerName);
}

function campaignRecording(): boolean {
  return playMode === "campaign" && !autoSolve;
}

function tapeLocked(): boolean {
  return (playMode === "replay" || autoSolve) && !feedingReplay;
}

function showDevTools(): boolean {
  return isDev() && playMode !== "replay" && !autoSolve;
}

function scheduleBeatCheck(): void {
  beatStatus = "wait";
  if (beatTimer) clearTimeout(beatTimer);
  beatTimer = setTimeout(() => {
    beatStatus = checkBeatable(draft) ? "yes" : "no";
  }, 280);
}

function stopAutoSolve(): void {
  autoSolve = false;
  replayCmds = [];
  replayI = 0;
  feedingReplay = false;
  if (!playBanner.startsWith("No solution")) playBanner = "";
}

function startBeatForMe(): void {
  if (!isDev() || !currentDef || screen !== "play") return;
  if (playMode === "replay") return;
  const solved = solveLevel(currentDef, 200_000);
  if (!solved.ok || !solved.cmds.length) {
    sound.play("fail");
    playBanner = "No solution found";
    return;
  }
  autoSolve = true;
  playBanner = "Auto-solve";
  replayCmds = solved.cmds;
  replayI = 0;
  feedingReplay = false;
  ghosts = [];
  pendingResult = null;
  busy = false;
  stage = new Stage(currentDef);
  stage.assemble = 0;
  renderer.cam = fitCamera(stage);
  enterPlay();
  sound.play("click");
}

function hudCode(): { label: string; value: string } {
  if (playMode === "campaign") return { label: "Passcode", value: stage?.def.code ?? "" };
  if (playMode === "puzzle") {
    const seed = puzzleQueue[puzzleQueueIndex]?.seed ?? "";
    const shown = seed.length > 28 ? `${seed.slice(0, 26)}…` : seed;
    return { label: "Seed", value: shown || stageId(currentDef ?? draft) };
  }
  return { label: "Seed", value: currentDef ? stageId(currentDef) : stageId(draft) };
}

function recordCmd(cmd: TapeCmd): void {
  if (!campaignRecording()) return;
  currentTape.push(cmd);
}

function commitAttempt(won: boolean): void {
  if (!campaignRecording()) return;
  if (currentTape.length) {
    pushGhost(levelIndex, currentTape);
    levelTapes.push({ cmds: [...currentTape], won });
  }
  currentTape = [];
}

function newHistoryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveCurrentRun(complete: boolean): void {
  if (!runLevels.length) return;
  saveRun({
    id: historyId || newHistoryId(),
    at: Date.now(),
    player: player(),
    totalTimeMs: sessionTimeMs || Math.max(0, now() - sessionStart),
    totalMoves: sessionMoves,
    fails: sessionFails,
    complete,
    levels: runLevels,
  });
  runFlushed = true;
}

function recordWonLevel(): void {
  if (!campaignRecording() || !stage) return;
  commitAttempt(true);
  runLevels.push({
    stage: levelIndex,
    timeMs: Math.max(0, now() - (levelBeganAt || sessionStart)),
    moves: stage.moves,
    attempts: stage.attempts,
    tapes: [...levelTapes],
  });
  levelTapes = [];
  levelBeganAt = 0;
}

function enterComplete(): void {
  sessionTimeMs = now() - sessionStart;
  saveCurrentRun(true);
  completeShowStats = false;
  completeStatsIndex = 0;
  screen = "complete";
  sound.stopAmbient();
  sound.startMenu();
}

function openHistory(view: "list" | "detail" = "list"): void {
  historyRuns = loadRuns();
  historyView = view;
  if (view === "list") {
    historyIndex = Math.min(historyIndex, Math.max(0, historyRuns.length - 1));
    historyRun = null;
  }
  screen = "history";
  sound.startMenu();
}

function runLabel(run: RunRecord): string {
  const d = new Date(run.at);
  const when = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  const last = run.levels.at(-1)?.stage ?? 0;
  const end = run.complete ? "All 33" : `Stage ${String(last + 1).padStart(2, "0")}`;
  return `${when}  ·  ${end}  ·  ${formatTime(run.totalTimeMs)}`;
}

function levelStatLabel(stat: LevelStat): string {
  const n = String(stat.stage + 1).padStart(2, "0");
  return `${n}  ·  ${formatTime(stat.timeMs)}  ·  ${stat.moves} moves  ·  ${stat.attempts} deaths`;
}

function historyRows(): string[] {
  if (historyView === "detail" && historyRun) return historyRun.levels.map(levelStatLabel);
  return historyRuns.map(runLabel);
}

function startReplay(stageIndex: number, cmds: TapeCmd[]): void {
  if (!cmds.length) return;
  playMode = "replay";
  replayCmds = cmds;
  replayI = 0;
  replayStage = stageIndex;
  ghosts = [];
  pendingResult = null;
  busy = false;
  const def = LEVELS[stageIndex];
  currentDef = cloneDef(def);
  currentTitle = `STAGE ${String(stageIndex + 1).padStart(2, "0")}`;
  currentAuthor = "";
  stage = new Stage(currentDef);
  stage.assemble = 1;
  renderer.cam = fitCamera(stage);
  if (seeGhosts) {
    ghosts = ghostsForStage(stageIndex, cmds).map((tape) => new GhostRunner(def, tape));
  }
  enterPlay();
}

function exitReplay(): void {
  ghosts = [];
  replayCmds = [];
  playMode = "campaign";
  stage = null;
  currentDef = null;
  sound.stopAmbient();
  openHistory("detail");
  sound.play("click");
}

function feedReplay(): void {
  if (screen !== "play" || !stage || busy) return;
  if (playMode !== "replay" && !autoSolve) return;
  if (replayI >= replayCmds.length) return;
  feedingReplay = true;
  const cmd = replayCmds[replayI];
  if (cmd === "swap") {
    if (!stage.anim) {
      stage.swapSplit();
      replayI++;
    }
    feedingReplay = false;
    return;
  }
  move(cmd);
  if (busy || stage.anim) replayI++;
  feedingReplay = false;
}

function leaveComplete(): void {
  completeShowStats = false;
  screen = "menu";
  sound.play("click");
  sound.startMenu();
}

function handleHistoryKey(e: KeyboardEvent): void {
  const rows = historyRows();
  if (backKey(e.key)) {
    if (historyView === "detail") {
      historyView = "list";
      historyRun = null;
      historyIndex = Math.min(historyIndex, Math.max(0, historyRuns.length - 1));
    } else {
      screen = "menu";
    }
    sound.play("click");
    return;
  }
  if (e.key === "g" || e.key === "G") {
    seeGhosts = !seeGhosts;
    saveSeeGhosts(seeGhosts);
    sound.play("click");
    return;
  }
  if (!rows.length) return;
  if (e.key === "ArrowDown") {
    historyIndex = (historyIndex + 1) % rows.length;
    sound.play("hover");
  } else if (e.key === "ArrowUp") {
    historyIndex = (historyIndex + rows.length - 1) % rows.length;
    sound.play("hover");
  } else if (confirmKey(e.key)) {
    chooseHistory(historyIndex);
  }
}

function chooseHistory(i: number): void {
  if (historyView === "list") {
    const run = historyRuns[i];
    if (!run) return;
    historyRun = run;
    historyView = "detail";
    historyIndex = 0;
    sound.play("click");
    return;
  }
  const level = historyRun?.levels[i];
  if (!level) return;
  const tape = winningTape(level);
  if (!tape) {
    sound.play("fail");
    return;
  }
  sound.play("click");
  startReplay(level.stage, tape);
}

function player(): string {
  return settings.playerName.trim() || "Player";
}

function isDev(): boolean {
  return isDevName(settings.playerName);
}

function campaignRows(): string[] {
  return LEVELS.map((l, i) => `Stage ${String(i + 1).padStart(2, "0")}  ·  ${l.code}`);
}

function applyBrand(): void {
  const title = brandName(settings.playerName);
  document.title = title;
  canvas.setAttribute("aria-label", title);
}

function creatorLabels(): string[] {
  if (creatorPage === "create") return ["New Stage", "Manage", "Back"];
  if (creatorPage === "play") return ["Enter Code", "Offline", "Online", "Back"];
  return ["Create", "Play", "Back"];
}

function creatorTitle(): string {
  if (creatorPage === "create") return "Create";
  if (creatorPage === "play") return "Play";
  return "Stage Creator";
}

function manageRows(): { label: string; kind: "packNew" | "stage" | "pack"; stage?: SavedStage; pack?: StagePack }[] {
  const rows: { label: string; kind: "packNew" | "stage" | "pack"; stage?: SavedStage; pack?: StagePack }[] = [
    { label: "Create Stage Pack", kind: "packNew" },
  ];
  for (const s of listSaved()) rows.push({ label: `Local · ${s.name}  ·  ${s.seed || stageId(s.def)}`, kind: "stage", stage: s });
  for (const s of listDownloaded()) rows.push({ label: `Downloaded · ${s.name}  ·  ${s.seed || stageId(s.def)}`, kind: "stage", stage: s });
  for (const p of listPacks()) rows.push({ label: `Pack · ${p.name}`, kind: "pack", pack: p });
  return rows;
}

function settingsRows(): { label: string; value: string }[] {
  const rows = [
    { label: "Name", value: settingsNameFocus ? `${settings.playerName}_` : player() },
    { label: "Music", value: `${Math.round(settings.music * 100)}%` },
    { label: "Sound FX", value: `${Math.round(settings.sfx * 100)}%` },
    { label: "Rumble", value: settings.rumble ? "On" : "Off" },
  ];
  for (const action of input.bindList()) {
    const listen =
      input.listening === action
        ? input.listenKind === "pad"
          ? "Press a button…"
          : "Press a key…"
        : `${input.keyName(action)}  /  ${input.padName(action)}`;
    rows.push({ label: ACTION_LABEL[action], value: listen });
  }
  rows.push({
    label: "Back",
    value: input.connected ? "Gamepad connected" : "No gamepad",
  });
  return rows;
}

function cloneDef(def: LevelDef): LevelDef {
  return JSON.parse(JSON.stringify(def)) as LevelDef;
}

function startSession(): void {
  if (runLevels.length && !runFlushed) saveCurrentRun(false);
  runFlushed = false;
  sessionMoves = 0;
  sessionFails = 0;
  sessionStart = now();
  sessionTimeMs = 0;
  runLevels = [];
  currentTape = [];
  levelTapes = [];
  levelBeganAt = 0;
  historyId = newHistoryId();
}

function beginCampaign(index: number, withTitle: boolean): void {
  levelIndex = index;
  if (index >= LEVELS.length) {
    enterComplete();
    return;
  }
  playMode = "campaign";
  resumeAt = index;
  beginFromDef(LEVELS[index], withTitle, `STAGE ${String(index + 1).padStart(2, "0")}`);
}

function beginFromDef(def: LevelDef, withTitle: boolean, title?: string, author?: string): void {
  currentDef = cloneDef(def);
  currentTitle = title ?? "";
  currentAuthor = author ?? "";
  stage = new Stage(currentDef);
  stage.assemble = 0;
  if (playMode === "campaign") {
    currentTape = [];
    levelTapes = [];
    levelBeganAt = 0;
  }
  renderer.cam = fitCamera(stage);
  if (withTitle) {
    screen = "title";
    titleT = 0;
    sound.stopAmbient();
    sound.play("title_card", { volume: 0.85 });
  } else {
    enterPlay();
  }
}

function enterPlay(): void {
  if (!stage) return;
  screen = "play";
  canvas.focus();
  sound.startAmbient();
  if (campaignRecording() && !levelBeganAt) levelBeganAt = now();
  if (stage.assemble < 1) {
    busy = true;
    pendingResult = "assemble";
    return;
  }
  stage.dropIn();
  busy = true;
  pendingResult = null;
  sound.play("drop_in", { volume: 0.8 });
}

function pointerPos(ev: MouseEvent | PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * STAGE_W,
    y: ((ev.clientY - r.top) / r.height) * STAGE_H,
  };
}

function move(dir: Dir): void {
  if (screen !== "play" || !stage || busy) return;
  if (tapeLocked()) return;
  if (!stage.tryMove(dir)) return;
  recordCmd(dir);
  input.rumble(90, 0.42, 0.62);
  busy = true;
  pendingResult = null;
}

function swapBlock(): void {
  if (!stage || screen !== "play") return;
  if (tapeLocked()) return;
  if (!stage.split) return;
  if (stage.anim && stage.anim.kind !== "splitdrop") return;
  stage.swapSplit();
  recordCmd("swap");
  sound.play("click", { volume: 0.5 });
}

function handlePlayResult(): void {
  if (!stage) return;
  const result = stage.finishMove((opened, closed) => {
    if (opened) sound.play("bridge_enabled");
    if (closed) sound.play("bridge_disabled");
    if (opened || closed) {
      sound.play("hover", { volume: 0.5 });
      input.rumble(80, 0.2, 0.35);
    }
  });
  const cells = stage.split
    ? [stage.active === 0 ? stage.cubeA : stage.cubeB]
    : stage.block
      ? [
          { x: stage.block.x, y: stage.block.y },
          ...(stage.block.ori === "up"
            ? []
            : stage.block.ori === "forward"
              ? [{ x: stage.block.x, y: stage.block.y + 1 }]
              : [{ x: stage.block.x + 1, y: stage.block.y }]),
        ]
      : [];
  const hollow = cells.some((c) => {
    const t = stage!.tileAt(c.x, c.y);
    return t === "fragile" || t === "bridgeL" || t === "bridgeR";
  });
  sound.move(hollow);

  if (playMode !== "replay") sessionMoves += 1;
  if (result === "win") {
    sound.play("whoosh", { volume: 0.95 });
    input.rumble(220, 0.45, 0.4);
    stage.beginSink();
    busy = true;
    pendingResult = "win";
    return;
  }
  if (result === "fail") {
    if (playMode !== "replay") {
      sessionFails++;
      stage.attempts++;
    }
    sound.play("fail");
    input.rumble(340, 0.85, 0.7);
    stage.beginFall();
    busy = true;
    pendingResult = "fail";
    return;
  }
  if (result === "split") {
    stage.beginSplit();
    if (!stage.split) {
      busy = false;
      pendingResult = null;
      return;
    }
    busy = true;
    pendingResult = "split";
    return;
  }
  busy = false;
  pendingResult = null;
}

function matchesAction(key: string, action: Action): boolean {
  const bound = settings.keys[action];
  if (key === bound) return true;
  if (bound === " " && (key === " " || key === "Spacebar" || key === "Space")) return true;
  return false;
}

function keyDir(key: string): Dir | null {
  if (matchesAction(key, "up") || key === "ArrowUp" || key === "w" || key === "W") return "up";
  if (matchesAction(key, "down") || key === "ArrowDown" || key === "s" || key === "S") return "down";
  if (matchesAction(key, "left") || key === "ArrowLeft" || key === "a" || key === "A") return "left";
  if (matchesAction(key, "right") || key === "ArrowRight" || key === "d" || key === "D") return "right";
  return null;
}

function confirmKey(key: string): boolean {
  return matchesAction(key, "confirm") || key === "Enter" || key === " ";
}

function backKey(key: string): boolean {
  return matchesAction(key, "back") || key === "Escape";
}

function menuEnabled(i: number): boolean {
  return i !== 1 || resumeAt !== null;
}

function stepMenu(dir: number): void {
  let i = menuIndex;
  for (let n = 0; n < MENU_COUNT; n++) {
    i = (i + dir + MENU_COUNT) % MENU_COUNT;
    if (menuEnabled(i)) {
      menuIndex = i;
      sound.play("hover");
      return;
    }
  }
}

function typingText(): boolean {
  if (screen === "nameEntry" || screen === "editorSave") return true;
  if (screen === "editor" && editorNameFocus) return true;
  if (screen === "settings" && settingsNameFocus) return true;
  if (screen === "puzzles" && puzzleSeedFocus) return true;
  return false;
}

function onKey(e: KeyboardEvent): void {
  if (input.justBound) {
    input.justBound = false;
    persist();
    return;
  }
  if (input.listening) return;
  if (e.repeat && (screen === "play" || screen === "author")) return;
  if (screen === "boot") {
    unlock();
    return;
  }
  if (screen === "nameEntry") {
    if (e.key === "Enter") {
      if (nameDraft.trim()) {
        const prev = settings.playerName;
        settings.playerName = nameDraft.trim();
        persist();
        maybeDevUnlock(prev, settings.playerName);
        screen = "menu";
        sound.startMenu();
        sound.play("click");
      }
      return;
    }
    if (e.key === "Backspace") {
      nameDraft = nameDraft.slice(0, -1);
      e.preventDefault();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && nameDraft.length < 16) {
      nameDraft += e.key;
      e.preventDefault();
    }
    return;
  }
  if (screen === "editor" && editorNameFocus) {
    if (e.key === "Escape") {
      editorNameFocus = false;
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      editorNameFocus = false;
      startEditorTest();
      return;
    }
    if (e.key === "Backspace") {
      editorName = editorName.slice(0, -1);
      e.preventDefault();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && editorName.length < 24) {
      editorName += e.key;
      e.preventDefault();
    }
    return;
  }
  if ((e.key === "m" || e.key === "M") && !typingText()) {
    const muted = sound.toggleMute();
    if (!muted) {
      if (screen === "play" || screen === "pause") sound.startAmbient();
      else sound.startMenu();
    }
    return;
  }

  if (screen === "menu") {
    if (e.key === "ArrowDown") stepMenu(1);
    else if (e.key === "ArrowUp") stepMenu(-1);
    else if (confirmKey(e.key)) {
      chooseMenu(menuIndex);
    }
    return;
  }

  if (screen === "ask") {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      askIndex = askIndex === 0 ? 1 : 0;
      sound.play("hover");
    } else if (confirmKey(e.key)) {
      chooseAsk(askIndex);
    } else if (backKey(e.key)) {
      screen = "menu";
      sound.play("click");
    }
    return;
  }

  if (screen === "author") {
    if (!e.repeat && splashT >= 1.25) advanceSplash();
    return;
  }

  if (screen === "credits") {
    screen = "menu";
    sound.play("click");
    return;
  }

  if (screen === "load") {
    if (backKey(e.key)) {
      screen = "menu";
      sound.play("click");
      return;
    }
    if (isDev()) {
      if (e.key === "ArrowDown") {
        loadIndex = (loadIndex + 1) % LEVELS.length;
        sound.play("hover");
      } else if (e.key === "ArrowUp") {
        loadIndex = (loadIndex + LEVELS.length - 1) % LEVELS.length;
        sound.play("hover");
      } else if (e.key === "Enter") {
        jumpCampaign(loadIndex);
      }
      return;
    }
    if (e.key === "ArrowLeft") loadCursor = Math.max(0, loadCursor - 1);
    else if (e.key === "ArrowRight") loadCursor = Math.min(5, loadCursor + 1);
    else if (e.key === "Backspace") {
      loadCode = loadCode.slice(0, -1);
      loadCursor = Math.max(0, loadCode.length);
      loadInvalid = false;
    } else if (/^[0-9]$/.test(e.key)) {
      if (loadCode.length >= 6) loadCode = loadCode.slice(0, 5);
      if (loadCode.length < 6) {
        loadCode = (loadCode + e.key).slice(0, 6);
        loadCursor = Math.min(5, loadCode.length);
      }
      loadInvalid = false;
      sound.play("hover");
      if (loadCode.length === 6) tryLoad();
    } else if (e.key === "Enter") {
      tryLoad();
    }
    return;
  }

  if (screen === "tutorial") {
    if (e.key === "ArrowRight" || confirmKey(e.key)) tutorialNext();
    else if (e.key === "ArrowLeft" || e.key === "Backspace") tutorialBack();
    else if (backKey(e.key)) tutorialSkip();
    return;
  }

  if (screen === "title") {
    if (titleT > 0.35) enterPlay();
    return;
  }

  if (screen === "complete") {
    if (e.key === "ArrowDown" && completeShowStats && runLevels.length) {
      completeStatsIndex = (completeStatsIndex + 1) % runLevels.length;
      sound.play("hover");
      return;
    }
    if (e.key === "ArrowUp" && completeShowStats && runLevels.length) {
      completeStatsIndex = (completeStatsIndex + runLevels.length - 1) % runLevels.length;
      sound.play("hover");
      return;
    }
    if (confirmKey(e.key) || e.key === "s" || e.key === "S") {
      if (!completeShowStats && (confirmKey(e.key) && e.key !== "s" && e.key !== "S")) {
        leaveComplete();
        return;
      }
      if (e.key === "s" || e.key === "S" || (completeShowStats && backKey(e.key))) {
        completeShowStats = !completeShowStats;
        sound.play("click");
        return;
      }
      if (completeShowStats) {
        completeShowStats = false;
        sound.play("click");
        return;
      }
      leaveComplete();
    }
    if (backKey(e.key)) {
      if (completeShowStats) {
        completeShowStats = false;
        sound.play("click");
      } else leaveComplete();
    }
    return;
  }

  if (screen === "history") {
    handleHistoryKey(e);
    return;
  }

  if (screen === "puzzles") {
    handlePuzzleKey(e);
    return;
  }

  if (screen === "pause") {
    if (e.key === "ArrowDown") {
      pauseIndex = (pauseIndex + 1) % PAUSE_COUNT;
      sound.play("hover");
    } else if (e.key === "ArrowUp") {
      pauseIndex = (pauseIndex + PAUSE_COUNT - 1) % PAUSE_COUNT;
      sound.play("hover");
    } else if (confirmKey(e.key)) {
      choosePause(pauseIndex);
    } else if (backKey(e.key) || matchesAction(e.key, "pause")) {
      screen = "play";
      sound.play("click");
    }
    return;
  }

  if (screen === "devMenu") {
    if (backKey(e.key)) {
      screen = "play";
      sound.play("click");
      return;
    }
    if (e.key === "ArrowDown") {
      loadIndex = (loadIndex + 1) % LEVELS.length;
      sound.play("hover");
    } else if (e.key === "ArrowUp") {
      loadIndex = (loadIndex + LEVELS.length - 1) % LEVELS.length;
      sound.play("hover");
    } else if (e.key === "Enter") {
      jumpCampaign(loadIndex);
    } else if (e.key === "n" || e.key === "N") {
      jumpCampaign(Math.min(LEVELS.length - 1, (playMode === "campaign" ? levelIndex : loadIndex) + 1));
    } else if (e.key === "p" || e.key === "P") {
      jumpCampaign(Math.max(0, (playMode === "campaign" ? levelIndex : loadIndex) - 1));
    } else if (e.key === "w" || e.key === "W") {
      screen = "play";
      afterWin();
    }
    return;
  }

  if (screen === "settings") {
    handleSettingsKey(e);
    return;
  }

  if (screen === "creatorHub") {
    handleCreatorKey(e);
    return;
  }

  if (screen === "editor") {
    if (backKey(e.key)) {
      screen = "creatorHub";
      creatorPage = "create";
      sound.play("click");
      return;
    }
    if (e.key === "Tab") {
      editorNameFocus = !editorNameFocus;
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      startEditorTest();
      return;
    }
    if (e.key === "[" || e.key === "q" || e.key === "Q") {
      cycleEditorTool(-1);
      return;
    }
    if (e.key === "]" || e.key === "e" || e.key === "E") {
      cycleEditorTool(1);
      return;
    }
    if (e.key === " " || e.key === "Spacebar") {
      paintCell(editorCursor.x, editorCursor.y);
      e.preventDefault();
      return;
    }
    const dir = keyDir(e.key);
    if (dir) {
      moveEditorCursor(dir);
      e.preventDefault();
    }
    return;
  }

  if (screen === "editorSave") {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      saveChoice = saveChoice === 0 ? 1 : 0;
      sound.play("hover");
    } else if (confirmKey(e.key)) chooseSave(saveChoice);
    else if (backKey(e.key)) chooseSave(1);
    else if (e.key === "Backspace") editorName = editorName.slice(0, -1);
    else if (e.key.length === 1 && editorName.length < 24 && !e.ctrlKey) editorName += e.key;
    return;
  }

  if (screen === "play") {
    if (playMode === "replay" || autoSolve) {
      if (e.key === "r" || e.key === "R") {
        if (playMode === "replay") startReplay(replayStage, replayCmds);
        else restartLevel();
        return;
      }
      if (backKey(e.key) || matchesAction(e.key, "pause")) {
        openPause();
      }
      return;
    }
    const dir = keyDir(e.key);
    if (dir) {
      e.preventDefault();
      move(dir);
      return;
    }
    if (matchesAction(e.key, "swap") || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      swapBlock();
      return;
    }
    if (e.key === "r" || e.key === "R") {
      restartLevel();
      return;
    }
    if (backKey(e.key) || matchesAction(e.key, "pause")) {
      openPause();
    }
  }
}

function handleSettingsKey(e: KeyboardEvent): void {
  const rows = settingsRows();
  const last = rows.length - 1;
  if (settingsNameFocus) {
    if (e.key === "Escape" || e.key === "Enter") {
      endNameEdit();
      e.preventDefault();
      return;
    }
    if (e.key === "Backspace") {
      settings.playerName = settings.playerName.slice(0, -1);
      e.preventDefault();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && settings.playerName.length < 16) {
      settings.playerName += e.key;
      e.preventDefault();
    }
    return;
  }
  if (backKey(e.key)) {
    screen = "menu";
    persist();
    sound.play("click");
    return;
  }
  if (e.key === "ArrowDown") {
    settingsIndex = (settingsIndex + 1) % rows.length;
    sound.play("hover");
    return;
  }
  if (e.key === "ArrowUp") {
    settingsIndex = (settingsIndex + last) % rows.length;
    sound.play("hover");
    return;
  }
  if (e.key === "ArrowLeft") {
    nudgeSetting(settingsIndex, -1);
    return;
  }
  if (e.key === "ArrowRight") {
    nudgeSetting(settingsIndex, 1);
    return;
  }
  if (e.key === "Enter") {
    if (settingsIndex === last) {
      screen = "menu";
      persist();
      sound.play("click");
      return;
    }
    if (settingsIndex === 0) {
      beginNameEdit();
      sound.play("click");
      return;
    }
    if (settingsIndex >= 4 && settingsIndex < last) {
      const action = input.bindList()[settingsIndex - 4];
      input.listening = action;
      input.listenKind = e.shiftKey ? "pad" : "key";
      sound.play("click");
    } else if (settingsIndex === 3) {
      nudgeSetting(3, 1);
    }
  }
}

function nudgeSetting(row: number, dir: number): void {
  if (row === 1) {
    settings.music = Math.max(0, Math.min(1, settings.music + dir * 0.05));
    persist();
    sound.play("hover");
  } else if (row === 2) {
    settings.sfx = Math.max(0, Math.min(1, settings.sfx + dir * 0.05));
    persist();
    sound.play("hover");
  } else if (row === 3) {
    settings.rumble = !settings.rumble;
    persist();
    if (settings.rumble) input.rumble(180, 0.6, 0.5);
    sound.play("click");
  }
}

function tryLoad(): void {
  const code = loadCode.padStart(6, "0");
  const i = levelByCode(code);
  if (i < 0) {
    loadInvalid = true;
    sound.play("fail");
    return;
  }
  jumpCampaign(i);
}

function jumpCampaign(index: number): void {
  const i = Math.max(0, Math.min(LEVELS.length - 1, index));
  sound.play("click");
  startSession();
  beginCampaign(i, true);
}

function openDevMenu(): void {
  if (!isDev()) return;
  loadIndex = playMode === "campaign" ? levelIndex : 0;
  screen = "devMenu";
  sound.play("click");
}

function chooseMenu(i: number): void {
  if (i === 1 && resumeAt === null) return;
  sound.play("click");
  if (i === 0) {
    tutorialSlide = 0;
    tutorialOffset = 18;
    screen = "tutorial";
  } else if (i === 1) {
    if (resumeAt === null) return;
    startSession();
    beginCampaign(resumeAt, true);
  } else if (i === 2) {
    loadCode = "";
    loadCursor = 0;
    loadInvalid = false;
    loadIndex = resumeAt ?? 0;
    screen = "load";
  } else if (i === 3) {
    creatorIndex = 0;
    creatorPage = "root";
    screen = "creatorHub";
  } else if (i === 4) {
    puzzlePage = "root";
    puzzleIndex = 0;
    puzzleMsg = "";
    screen = "puzzles";
  } else if (i === 5) {
    openHistory("list");
  } else if (i === 6) {
    settingsIndex = 0;
    screen = "settings";
  } else if (i === 7) {
    const muted = sound.toggleMute();
    if (!muted) sound.startMenu();
  } else {
    screen = "credits";
  }
}

function chooseAsk(i: number): void {
  sound.play("click");
  if (i === 0) {
    tutorialSlide = 0;
    tutorialOffset = 18;
    screen = "tutorial";
  } else {
    startSession();
    beginCampaign(0, true);
  }
}

function openPause(): void {
  pauseIndex = 0;
  pauseSlide = 0;
  screen = "pause";
  sound.play("click");
}

function choosePause(i: number): void {
  if (i === 0) {
    screen = "play";
    sound.play("click");
  } else if (i === 1) {
    sound.play("click");
    restartLevel();
  } else if (i === 2) {
    const muted = sound.toggleMute();
    if (!muted) sound.startAmbient();
    sound.play("click");
  } else {
    sound.play("click");
    stopAutoSolve();
    if (playMode === "replay") {
      exitReplay();
      return;
    }
    if (campaignRecording() && runLevels.length) saveCurrentRun(false);
    sound.startMenu();
    if (playMode === "editor-test") screen = "editor";
    else if (playMode === "custom") {
      screen = "creatorHub";
      creatorPage = customQueue.length > 1 ? "manage" : "offline";
    } else if (playMode === "puzzle") {
      screen = "puzzles";
    } else {
      resumeAt = levelIndex;
      screen = "menu";
    }
  }
}

function handleCreatorKey(e: KeyboardEvent): void {
  if (creatorPage === "enterCode") {
    if (backKey(e.key)) {
      creatorPage = "play";
      creatorIndex = 0;
      sound.play("click");
      return;
    }
    if (e.key === "Enter") {
      tryPastePlay();
      return;
    }
    if (e.key === "Backspace") {
      pasteBuf = pasteBuf.slice(0, -1);
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) pasteBuf += e.key;
    return;
  }
  if (creatorPage === "offline" || creatorPage === "online") {
    const list = creatorPage === "offline" ? listSaved() : onlineStages;
    if (backKey(e.key)) {
      creatorPage = "play";
      creatorIndex = 0;
      sound.play("click");
      return;
    }
    if (e.key === "ArrowDown" && list.length) {
      customIndex = (customIndex + 1) % list.length;
      sound.play("hover");
    } else if (e.key === "ArrowUp" && list.length) {
      customIndex = (customIndex + list.length - 1) % list.length;
      sound.play("hover");
    } else if (confirmKey(e.key) && list[customIndex]) {
      if (creatorPage === "online") saveStage({ ...list[customIndex], source: "downloaded" });
      playSaved(list[customIndex]);
    }
    return;
  }
  if (creatorPage === "manage") {
    const rows = manageRows();
    if (backKey(e.key)) {
      creatorPage = "create";
      creatorIndex = 0;
      sound.play("click");
      return;
    }
    if (e.key === "ArrowDown" && rows.length) {
      creatorIndex = (creatorIndex + 1) % rows.length;
      sound.play("hover");
    } else if (e.key === "ArrowUp" && rows.length) {
      creatorIndex = (creatorIndex + rows.length - 1) % rows.length;
      sound.play("hover");
    } else if (e.key === "Delete" || e.key === "Backspace") {
      const row = rows[creatorIndex];
      if (row?.kind === "stage" && row.stage) {
        deleteStage(row.stage.code);
        sound.play("click");
      } else if (row?.kind === "pack" && row.pack) {
        deletePack(row.pack.id);
        sound.play("click");
      }
    } else if (confirmKey(e.key) && rows[creatorIndex]) {
      const row = rows[creatorIndex];
      if (row.kind === "packNew") {
        packDraft = { id: `pack-${Date.now()}`, name: "My Pack", author: player(), codes: [] };
        packNameFocus = true;
        creatorPage = "packEdit";
        creatorIndex = 0;
      } else if (row.kind === "stage" && row.stage) {
        draft = cloneDef(row.stage.def);
        editorName = row.stage.name;
        editorCursor = { x: draft.spawn[0], y: draft.spawn[1] };
        paintState = newPaintState(editorTool);
        screen = "editor";
        scheduleBeatCheck();
      } else if (row.kind === "pack" && row.pack) {
        const stages = packStages(row.pack);
        if (stages[0]) playSaved(stages[0], stages, 0);
      }
    }
    return;
  }
  if (creatorPage === "packEdit") {
    const all = listAllStages();
    if (packNameFocus) {
      if (e.key === "Enter" || e.key === "Escape") {
        packNameFocus = false;
        return;
      }
      if (e.key === "Backspace") packDraft.name = packDraft.name.slice(0, -1);
      else if (e.key.length === 1 && !e.ctrlKey && packDraft.name.length < 24) packDraft.name += e.key;
      return;
    }
    if (backKey(e.key)) {
      creatorPage = "manage";
      creatorIndex = 0;
      sound.play("click");
      return;
    }
    if (e.key === "s" || e.key === "S") {
      if (packDraft.codes.length) {
        packDraft.author = player();
        savePack(packDraft);
        creatorPage = "manage";
        sound.play("click");
      }
      return;
    }
    if (e.key === "Tab") {
      packNameFocus = true;
      return;
    }
    if (e.key === "ArrowDown" && all.length) {
      creatorIndex = (creatorIndex + 1) % all.length;
      sound.play("hover");
    } else if (e.key === "ArrowUp" && all.length) {
      creatorIndex = (creatorIndex + all.length - 1) % all.length;
      sound.play("hover");
    } else if (confirmKey(e.key) && all[creatorIndex]) {
      const code = all[creatorIndex].code;
      if (packDraft.codes.includes(code)) packDraft.codes = packDraft.codes.filter((c) => c !== code);
      else packDraft.codes.push(code);
      sound.play("click");
    }
    return;
  }
  const labels = creatorLabels();
  if (e.key === "ArrowDown") {
    creatorIndex = (creatorIndex + 1) % labels.length;
    sound.play("hover");
  } else if (e.key === "ArrowUp") {
    creatorIndex = (creatorIndex + labels.length - 1) % labels.length;
    sound.play("hover");
  } else if (confirmKey(e.key)) chooseCreator(creatorIndex);
  else if (backKey(e.key)) {
    if (creatorPage === "root") screen = "menu";
    else {
      creatorPage = "root";
      creatorIndex = 0;
    }
    sound.play("click");
  }
}

function chooseCreator(i: number): void {
  sound.play("click");
  const labels = creatorLabels();
  const label = labels[i];
  if (creatorPage === "root") {
    if (label === "Create") {
      creatorPage = "create";
      creatorIndex = 0;
    } else if (label === "Play") {
      creatorPage = "play";
      creatorIndex = 0;
    } else {
      screen = "menu";
    }
    return;
  }
  if (creatorPage === "create") {
    if (label === "New Stage") openNewStage();
    else if (label === "Manage") {
      creatorPage = "manage";
      creatorIndex = 0;
    } else {
      creatorPage = "root";
      creatorIndex = 0;
    }
    return;
  }
  if (creatorPage === "play") {
    if (label === "Enter Code") {
      creatorPage = "enterCode";
      pasteBuf = "";
      customMsg = "Paste a BX1 code or BXS seed.";
    } else if (label === "Offline") {
      creatorPage = "offline";
      customIndex = 0;
    } else if (label === "Online") {
      creatorPage = "online";
      customIndex = 0;
      onlineStatus = "Loading community stages…";
      void loadOnline();
    } else {
      creatorPage = "root";
      creatorIndex = 0;
    }
  }
}

function openNewStage(): void {
  draft = emptyDraft();
  editorName = "My Stage";
  editorNameFocus = false;
  editorTool = "stone";
  editorCursor = { x: draft.spawn[0], y: draft.spawn[1] };
  editorHint = "Arrows / stick move. Confirm paints. [ ] or LB/RB cycle tools. One spawn and one exit.";
  paintState = newPaintState("stone");
  screen = "editor";
  scheduleBeatCheck();
}

function cycleEditorTool(dir: number): void {
  const i = EDITOR_TOOLS.findIndex((t) => t.id === editorTool);
  const tool = EDITOR_TOOLS[(i + dir + EDITOR_TOOLS.length) % EDITOR_TOOLS.length];
  editorTool = tool.id;
  paintState.tool = tool.id;
  if (tool.id !== "split") {
    paintState.splitStep = 0;
    paintState.splitAt = null;
  }
  sound.play("hover");
}

function moveEditorCursor(dir: Dir): void {
  if (dir === "left") editorCursor.x = Math.max(0, editorCursor.x - 1);
  if (dir === "right") editorCursor.x = Math.min(14, editorCursor.x + 1);
  if (dir === "up") editorCursor.y = Math.max(0, editorCursor.y - 1);
  if (dir === "down") editorCursor.y = Math.min(9, editorCursor.y + 1);
}

async function loadOnline(): Promise<void> {
  onlineStages = await fetchOnlineStages();
  onlineStatus = onlineStages.length ? "" : "No community stages found. Check your connection.";
}

function startEditorTest(): void {
  const err = isPlayable(draft);
  if (err) {
    editorHint = err;
    sound.play("fail");
    return;
  }
  sound.play("click");
  playMode = "editor-test";
  beginFromDef(draft, false);
}

function paintCell(x: number, y: number): void {
  paintState.tool = editorTool;
  paintEditorCell(draft, x, y, paintState);
  if (paintState.hint) editorHint = paintState.hint;
  scheduleBeatCheck();
}

function playSaved(item: SavedStage, queue?: SavedStage[], index = 0): void {
  sound.play("click");
  playMode = "custom";
  editorName = item.name;
  customQueue = queue ?? [];
  customQueueIndex = index;
  customOrigin = queue ? "manage" : creatorPage;
  beginFromDef(item.def, true, item.name, `by ${item.author}`);
}

function startPuzzleAt(index: number): void {
  const p = puzzleQueue[index];
  if (!p) return;
  puzzleQueueIndex = index;
  playMode = "puzzle";
  const n = puzzleQueue.length;
  const kind = puzzleQueue[0]?.seed.startsWith("daily:") ? "Daily" : "Seeded";
  const title = n > 1 ? `${kind.toUpperCase()} ${String(index + 1).padStart(2, "0")}/${String(n).padStart(2, "0")}` : kind.toUpperCase();
  beginFromDef(p.def, true, title, `${difficultyLabel(p.difficulty)} · ${p.solutionLen} moves`);
}

function launchPuzzles(list: Puzzle[]): void {
  if (!list.length) {
    puzzleMsg = "Could not build a puzzle. Try another seed.";
    sound.play("fail");
    return;
  }
  puzzleQueue = list;
  puzzleMsg = "";
  sound.play("click");
  startPuzzleAt(0);
}

function playDaily(): void {
  puzzleMsg = "Building today’s puzzle…";
  const seed = dailySeed(new Date(), puzzleDiff);
  launchPuzzles([generatePuzzle(seed, puzzleDiff)]);
}

function playSeeded(): void {
  const seed = puzzleSeed.trim() || "BLOX";
  puzzleMsg = "Building puzzles…";
  launchPuzzles(generateRun(seed, puzzleDiff, puzzleLength));
}

function puzzleLabels(): string[] {
  if (puzzlePage === "daily") return [...DIFFICULTIES.map(difficultyLabel), "Back"];
  if (puzzlePage === "seeded") return [];
  return ["Daily", "Seeded Run", "Back"];
}

function handlePuzzleKey(e: KeyboardEvent): void {
  if (puzzlePage === "root") {
    if (backKey(e.key)) {
      screen = "menu";
      sound.play("click");
      return;
    }
    if (e.key === "ArrowDown") {
      puzzleIndex = (puzzleIndex + 1) % 3;
      sound.play("hover");
    } else if (e.key === "ArrowUp") {
      puzzleIndex = (puzzleIndex + 2) % 3;
      sound.play("hover");
    } else if (confirmKey(e.key)) choosePuzzle(puzzleIndex);
    return;
  }
  if (puzzlePage === "daily") {
    const n = DIFFICULTIES.length + 1;
    if (backKey(e.key)) {
      puzzlePage = "root";
      puzzleIndex = 0;
      sound.play("click");
      return;
    }
    if (e.key === "ArrowDown") {
      puzzleIndex = (puzzleIndex + 1) % n;
      sound.play("hover");
    } else if (e.key === "ArrowUp") {
      puzzleIndex = (puzzleIndex + n - 1) % n;
      sound.play("hover");
    } else if (confirmKey(e.key)) {
      if (puzzleIndex >= DIFFICULTIES.length) {
        puzzlePage = "root";
        puzzleIndex = 0;
      } else {
        puzzleDiff = DIFFICULTIES[puzzleIndex];
        playDaily();
      }
    }
    return;
  }
  if (puzzleSeedFocus) {
    if (e.key === "Escape" || e.key === "Enter") {
      puzzleSeedFocus = false;
      puzzleFocus = "diff";
      e.preventDefault();
      return;
    }
    if (e.key === "Backspace") {
      puzzleSeed = puzzleSeed.slice(0, -1);
      e.preventDefault();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && puzzleSeed.length < 24) {
      puzzleSeed += e.key;
      e.preventDefault();
    }
    return;
  }
  if (backKey(e.key)) {
    puzzlePage = "root";
    puzzleIndex = 1;
    sound.play("click");
    return;
  }
  if (e.key === "ArrowDown") {
    if (puzzleFocus === "seed") puzzleFocus = "diff";
    else if (puzzleFocus === "diff") puzzleFocus = "length";
    else if (puzzleFocus === "length") puzzleFocus = "play";
    else puzzleFocus = "seed";
    sound.play("hover");
  } else if (e.key === "ArrowUp") {
    if (puzzleFocus === "play") puzzleFocus = "length";
    else if (puzzleFocus === "length") puzzleFocus = "diff";
    else if (puzzleFocus === "diff") puzzleFocus = "seed";
    else puzzleFocus = "play";
    sound.play("hover");
  } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const dir = e.key === "ArrowRight" ? 1 : -1;
    if (puzzleFocus === "diff") {
      const i = DIFFICULTIES.indexOf(puzzleDiff);
      puzzleDiff = DIFFICULTIES[(i + dir + DIFFICULTIES.length) % DIFFICULTIES.length];
    } else if (puzzleFocus === "length") {
      const i = RUN_LENGTHS.indexOf(puzzleLength as (typeof RUN_LENGTHS)[number]);
      const ni = (Math.max(0, i) + dir + RUN_LENGTHS.length) % RUN_LENGTHS.length;
      puzzleLength = RUN_LENGTHS[ni];
    }
    sound.play("hover");
  } else if (confirmKey(e.key)) {
    if (puzzleFocus === "seed") puzzleSeedFocus = true;
    else playSeeded();
  }
}

function choosePuzzle(i: number): void {
  sound.play("click");
  if (i === 0) {
    puzzlePage = "daily";
    puzzleIndex = DIFFICULTIES.indexOf(puzzleDiff);
    puzzleMsg = "";
  } else if (i === 1) {
    puzzlePage = "seeded";
    puzzleFocus = "seed";
    puzzleMsg = "";
  } else {
    screen = "menu";
  }
}

function tryPastePlay(): void {
  const def = parseShare(pasteBuf, onlineStages);
  if (!def) {
    const short = pasteBuf.trim().toUpperCase().match(/^BXS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    customMsg = short
      ? "That seed isn’t on this device. Paste a BXS. or BX1 code, or open it from Offline / Online."
      : "That code is not a valid stage.";
    sound.play("fail");
    return;
  }
  sound.play("click");
  playMode = "custom";
  customOrigin = "enterCode";
  beginFromDef(def, true, "Shared Stage", stageId(def));
}

function chooseSave(i: number): void {
  if (i === 0) {
    const name = editorName.trim() || "My Stage";
    const code = encodeLevel(draft);
    const seed = encodeSeed(draft);
    const id = stageId(draft);
    saveStage({ name, author: player(), code, seed: id, def: cloneDef(draft), source: "local" });
    const copied = `${id}\n${seed}\n${code}`;
    void navigator.clipboard?.writeText(copied);
    shareCode = code;
    saveMsg = "Saved. Seed copied to clipboard.";
    sound.play("click");
    screen = "creatorHub";
    creatorPage = "manage";
  } else {
    screen = "editor";
    sound.play("click");
  }
}

function tutorialSkip(): void {
  sound.play("click");
  startSession();
  beginCampaign(0, true);
}

function tutorialNext(): void {
  sound.play("click");
  if (tutorialSlide < 8) {
    tutorialSlide++;
    tutorialOffset = 18;
  } else {
    startSession();
    beginCampaign(0, true);
  }
}

function tutorialBack(): void {
  sound.play("click");
  if (tutorialSlide === 0) screen = "menu";
  else {
    tutorialSlide--;
    tutorialOffset = -18;
  }
}

function restartLevel(): void {
  if (!currentDef) return;
  if (autoSolve) stopAutoSolve();
  if (playMode === "replay") {
    startReplay(replayStage, replayCmds);
    return;
  }
  if (playMode === "campaign") {
    sessionFails++;
    commitAttempt(false);
    const deaths = (stage?.attempts ?? 0) + 1;
    stage = new Stage(currentDef);
    stage.attempts = deaths;
  } else {
    sessionFails++;
    stage = new Stage(currentDef);
  }
  renderer.cam = fitCamera(stage);
  enterPlay();
}

function unlock(): void {
  sound.unlock();
  screen = "author";
  splashT = 0;
}

function advanceSplash(): void {
  if (!settings.playerName.trim()) {
    nameDraft = "";
    screen = "nameEntry";
  } else {
    screen = "menu";
    sound.startMenu();
  }
}

function afterWin(): void {
  stopAutoSolve();
  playBanner = "";
  if (playMode === "replay") {
    exitReplay();
    return;
  }
  if (playMode === "editor-test") {
    shareCode = encodeLevel(draft);
    saveChoice = 0;
    saveMsg = editorName;
    screen = "editorSave";
    sound.startMenu();
    return;
  }
  if (playMode === "custom") {
    if (customQueue.length && customQueueIndex + 1 < customQueue.length) {
      playSaved(customQueue[customQueueIndex + 1], customQueue, customQueueIndex + 1);
      return;
    }
    screen = "creatorHub";
    creatorPage = customQueue.length ? "manage" : customOrigin;
    customMsg = "Stage complete.";
    sound.startMenu();
    return;
  }
  if (playMode === "puzzle") {
    if (puzzleQueueIndex + 1 < puzzleQueue.length) {
      startPuzzleAt(puzzleQueueIndex + 1);
      return;
    }
    puzzleMsg = puzzleQueue.length > 1 ? "Run complete." : "Puzzle complete.";
    screen = "puzzles";
    sound.startMenu();
    return;
  }
  recordWonLevel();
  beginCampaign(levelIndex + 1, true);
}

canvas.addEventListener("pointerdown", (e) => {
  const p = pointerPos(e);
  if (screen === "boot") {
    unlock();
    return;
  }
  if (screen === "menu") {
    const hit = renderer.hitMenu(p.x, p.y, MENU_Y, MENU_COUNT);
    if (hit !== null) {
      if (hit === 1 && resumeAt === null) return;
      menuIndex = hit;
      chooseMenu(hit);
    }
    return;
  }
  if (screen === "ask") {
    const hit = renderer.hitAsk(p.x, p.y);
    if (hit !== null) {
      askIndex = hit;
      chooseAsk(hit);
    }
    return;
  }
  if (screen === "author") {
    if (splashT >= 1.25) advanceSplash();
    return;
  }
  if (screen === "credits") {
    screen = "menu";
    sound.play("click");
    return;
  }
  if (screen === "load") {
    if (isDev()) {
      const hit = renderer.hitStageList(p.x, p.y, LEVELS.length, loadIndex);
      if (hit !== null) {
        loadIndex = hit;
        jumpCampaign(hit);
        return;
      }
      if (renderer.hitListBack(p.x, p.y) || renderer.hitLoad(p.x, p.y) === "back") {
        screen = "menu";
        sound.play("click");
      }
      return;
    }
    const hit = renderer.hitLoad(p.x, p.y);
    if (hit === "back") {
      screen = "menu";
      sound.play("click");
      return;
    }
    if (hit === "enter") tryLoad();
    return;
  }
  if (screen === "history") {
    if (renderer.hitGhostsToggle(p.x, p.y)) {
      seeGhosts = !seeGhosts;
      saveSeeGhosts(seeGhosts);
      sound.play("click");
      return;
    }
    if (renderer.hitListBack(p.x, p.y)) {
      if (historyView === "detail") {
        historyView = "list";
        historyRun = null;
        historyIndex = Math.min(historyIndex, Math.max(0, historyRuns.length - 1));
      } else screen = "menu";
      sound.play("click");
      return;
    }
    const rows = historyRows();
    const hit = renderer.hitStageList(p.x, p.y, rows.length, historyIndex);
    if (hit !== null) {
      historyIndex = hit;
      chooseHistory(hit);
    }
    return;
  }
  if (screen === "puzzles") {
    if (puzzlePage === "root") {
      const hit = renderer.hitCreatorHub(p.x, p.y, 3);
      if (hit !== null) {
        puzzleIndex = hit;
        choosePuzzle(hit);
      }
      return;
    }
    if (puzzlePage === "daily") {
      const n = DIFFICULTIES.length + 1;
      const hit = renderer.hitCreatorHub(p.x, p.y, n);
      if (hit !== null) {
        puzzleIndex = hit;
        if (hit >= DIFFICULTIES.length) {
          puzzlePage = "root";
          puzzleIndex = 0;
          sound.play("click");
        } else {
          puzzleDiff = DIFFICULTIES[hit];
          playDaily();
        }
      }
      return;
    }
    if (renderer.hitListBack(p.x, p.y)) {
      puzzlePage = "root";
      puzzleIndex = 1;
      sound.play("click");
      return;
    }
    if (renderer.hitPuzzleSeed(p.x, p.y)) {
      puzzleSeedFocus = true;
      puzzleFocus = "seed";
      sound.play("click");
      return;
    }
    if (renderer.hitPuzzlePlay(p.x, p.y)) {
      playSeeded();
      return;
    }
    const d = renderer.hitPuzzleDiff(p.x, p.y, true);
    if (d !== null) {
      puzzleDiff = DIFFICULTIES[d];
      puzzleFocus = "diff";
      sound.play("hover");
      return;
    }
    const len = renderer.hitPuzzleLength(p.x, p.y, true);
    if (len !== null) {
      puzzleLength = RUN_LENGTHS[len];
      puzzleFocus = "length";
      sound.play("hover");
    }
    return;
  }
  if (screen === "tutorial") {
    const nav = renderer.hitTutorialNav(p.x, p.y);
    if (nav === "next") tutorialNext();
    if (nav === "back") tutorialBack();
    if (nav === "skip") tutorialSkip();
    return;
  }
  if (screen === "complete") {
    const hit = renderer.hitComplete(p.x, p.y, completeShowStats, runLevels.length, completeStatsIndex);
    if (hit === "stats") {
      completeShowStats = !completeShowStats;
      sound.play("click");
    } else if (typeof hit === "number") {
      completeStatsIndex = hit;
    } else if (hit === "done" && !completeShowStats) {
      leaveComplete();
    }
    return;
  }
  if (screen === "pause") {
    const hit = renderer.hitPause(p.x, p.y);
    if (hit !== null) {
      pauseIndex = hit;
      choosePause(hit);
    }
    return;
  }
  if (screen === "settings") {
    const hit = renderer.hitSettings(p.x, p.y, settingsRows().length);
    if (hit) {
      settingsIndex = hit.row;
      const last = settingsRows().length - 1;
      if (hit.row === last) {
        screen = "menu";
        persist();
        sound.play("click");
      } else if (hit.row === 0) {
        beginNameEdit();
        sound.play("click");
      } else if (hit.row <= 3) {
        nudgeSetting(hit.row, hit.side === "right" ? 1 : -1);
      } else {
        const action = input.bindList()[hit.row - 4];
        input.listening = action;
        input.listenKind = hit.side === "right" ? "pad" : "key";
        sound.play("click");
      }
    }
    return;
  }
  if (screen === "creatorHub") {
    if (creatorPage === "root" || creatorPage === "create" || creatorPage === "play") {
      const hit = renderer.hitCreatorHub(p.x, p.y, creatorLabels().length);
      if (hit !== null) {
        creatorIndex = hit;
        chooseCreator(hit);
      }
      return;
    }
    if (creatorPage === "offline" || creatorPage === "online") {
      const list = creatorPage === "offline" ? listSaved() : onlineStages;
      const hit = renderer.hitStageList(p.x, p.y, list.length, customIndex);
      if (hit !== null) {
        customIndex = hit;
        if (creatorPage === "online") saveStage({ ...list[hit], source: "downloaded" });
        playSaved(list[hit]);
      } else if (renderer.hitListBack(p.x, p.y)) {
        creatorPage = "play";
        creatorIndex = 0;
        sound.play("click");
      }
      return;
    }
    if (creatorPage === "manage") {
      const rows = manageRows();
      const hit = renderer.hitStageList(p.x, p.y, rows.length, creatorIndex);
      if (hit !== null) {
        creatorIndex = hit;
        handleCreatorKey({ key: "Enter" } as KeyboardEvent);
      } else if (renderer.hitListBack(p.x, p.y)) {
        creatorPage = "create";
        creatorIndex = 0;
        sound.play("click");
      }
      return;
    }
    if (creatorPage === "packEdit") {
      if (renderer.hitPackName(p.x, p.y)) {
        packNameFocus = true;
        sound.play("hover");
        return;
      }
      packNameFocus = false;
      const all = listAllStages();
      const hit = renderer.hitPackList(p.x, p.y, all.length, creatorIndex);
      if (hit !== null) {
        creatorIndex = hit;
        handleCreatorKey({ key: "Enter" } as KeyboardEvent);
        return;
      }
      const foot = renderer.hitPackFooter(p.x, p.y);
      if (foot === "save") handleCreatorKey({ key: "s" } as KeyboardEvent);
      else if (foot === "back") {
        creatorPage = "manage";
        creatorIndex = 0;
        sound.play("click");
      }
      return;
    }
    if (creatorPage === "enterCode") {
      const hit = renderer.hitEnterCode(p.x, p.y);
      if (hit === "play") tryPastePlay();
      else if (hit === "back") {
        creatorPage = "play";
        creatorIndex = 0;
        sound.play("click");
      }
    }
    return;
  }
  if (screen === "editor") {
    if (renderer.hitEditorName(p.x, p.y)) {
      editorNameFocus = true;
      sound.play("hover");
      return;
    }
    editorNameFocus = false;
    const head = renderer.hitEditorHeader(p.x, p.y);
    if (head === "test") {
      startEditorTest();
      return;
    }
    if (head === "back") {
      screen = "creatorHub";
      sound.play("click");
      return;
    }
    const tool = renderer.hitEditorTool(p.x, p.y, EDITOR_TOOLS.length);
    if (tool !== null) {
      editorTool = EDITOR_TOOLS[tool].id;
      paintState.tool = editorTool;
      if (editorTool !== "split") {
        paintState.splitStep = 0;
        paintState.splitAt = null;
      }
      sound.play("hover");
      return;
    }
    const cell = renderer.hitEditorCell(p.x, p.y);
    if (cell) {
      paintHeld = true;
      paintCell(cell.x, cell.y);
    }
    return;
  }
  if (screen === "editorSave") {
    const hit = renderer.hitSavePrompt(p.x, p.y);
    if (hit !== null) chooseSave(hit);
    return;
  }
  if (screen === "play") {
    if (showDevTools() && renderer.hitBeatTab(p.x, p.y)) {
      startBeatForMe();
      return;
    }
    if (showDevTools() && renderer.hitDevTab(p.x, p.y)) {
      openDevMenu();
      return;
    }
    if (renderer.hitMenuTab(p.x, p.y, playMode === "editor-test" || playMode === "replay")) {
      if (playMode === "editor-test") {
        stopAutoSolve();
        screen = "editor";
        sound.play("click");
        sound.startMenu();
        return;
      }
      if (playMode === "replay") {
        exitReplay();
        return;
      }
      openPause();
    }
    return;
  }
  if (screen === "devMenu") {
    const row = renderer.hitDevMenuList(p.x, p.y, LEVELS.length, loadIndex);
    if (row !== null) {
      loadIndex = row;
      jumpCampaign(row);
      return;
    }
    const foot = renderer.hitDevMenuFooter(p.x, p.y);
    if (foot === "close") {
      screen = "play";
      sound.play("click");
    } else if (foot === "next") {
      jumpCampaign(Math.min(LEVELS.length - 1, (playMode === "campaign" ? levelIndex : loadIndex) + 1));
    } else if (foot === "prev") {
      jumpCampaign(Math.max(0, (playMode === "campaign" ? levelIndex : loadIndex) - 1));
    } else if (foot === "win") {
      screen = "play";
      afterWin();
    }
  }
});

canvas.addEventListener("pointerup", () => {
  paintHeld = false;
});

function pointerOverHit(p: { x: number; y: number }): boolean {
  switch (screen) {
    case "menu": {
      const hit = renderer.hitMenu(p.x, p.y, MENU_Y, MENU_COUNT);
      if (hit === 1 && resumeAt === null) return false;
      return hit !== null;
    }
    case "ask":
      return renderer.hitAsk(p.x, p.y) !== null;
    case "load":
      if (isDev()) {
        return renderer.hitStageList(p.x, p.y, LEVELS.length, loadIndex) !== null || renderer.hitListBack(p.x, p.y);
      }
      return renderer.hitLoad(p.x, p.y) !== null;
    case "tutorial": {
      const nav = renderer.hitTutorialNav(p.x, p.y);
      if (nav === "back" && tutorialSlide === 0) return false;
      return nav !== null;
    }
    case "play":
      if (showDevTools() && (renderer.hitBeatTab(p.x, p.y) || renderer.hitDevTab(p.x, p.y))) return true;
      return renderer.hitMenuTab(p.x, p.y, playMode === "editor-test" || playMode === "replay");
    case "devMenu":
      return (
        renderer.hitDevMenuList(p.x, p.y, LEVELS.length, loadIndex) !== null ||
        renderer.hitDevMenuFooter(p.x, p.y) !== null
      );
    case "pause":
      return renderer.hitPause(p.x, p.y) !== null || renderer.hitMenuTab(p.x, p.y);
    case "settings":
      return renderer.hitSettings(p.x, p.y, settingsRows().length) !== null;
    case "creatorHub":
      return creatorPointerHit(p) !== null;
    case "editor":
      return (
        renderer.hitEditorName(p.x, p.y) ||
        renderer.hitEditorHeader(p.x, p.y) !== null ||
        renderer.hitEditorTool(p.x, p.y, EDITOR_TOOLS.length) !== null ||
        renderer.hitEditorCell(p.x, p.y) !== null
      );
    case "editorSave":
      return renderer.hitSavePrompt(p.x, p.y) !== null;
    case "complete": {
      const hit = renderer.hitComplete(p.x, p.y, completeShowStats, runLevels.length, completeStatsIndex);
      return hit === "stats" || hit === "done" || typeof hit === "number";
    }
    case "history":
      return (
        renderer.hitGhostsToggle(p.x, p.y) ||
        renderer.hitListBack(p.x, p.y) ||
        renderer.hitStageList(p.x, p.y, historyRows().length, historyIndex) !== null
      );
    case "puzzles":
      if (puzzlePage === "root") return renderer.hitCreatorHub(p.x, p.y, 3) !== null;
      if (puzzlePage === "daily") return renderer.hitCreatorHub(p.x, p.y, DIFFICULTIES.length + 1) !== null;
      return (
        renderer.hitListBack(p.x, p.y) ||
        renderer.hitPuzzlePlay(p.x, p.y) ||
        renderer.hitPuzzleSeed(p.x, p.y) ||
        renderer.hitPuzzleDiff(p.x, p.y, true) !== null ||
        renderer.hitPuzzleLength(p.x, p.y, true) !== null
      );
    default:
      return false;
  }
}

function creatorPointerHit(p: { x: number; y: number }): string | number | null {
  if (creatorPage === "root" || creatorPage === "create" || creatorPage === "play") {
    return renderer.hitCreatorHub(p.x, p.y, creatorLabels().length);
  }
  if (creatorPage === "enterCode") return renderer.hitEnterCode(p.x, p.y);
  if (creatorPage === "offline") {
    if (renderer.hitListBack(p.x, p.y)) return "back";
    return renderer.hitStageList(p.x, p.y, listSaved().length, customIndex);
  }
  if (creatorPage === "online") {
    if (renderer.hitListBack(p.x, p.y)) return "back";
    return renderer.hitStageList(p.x, p.y, onlineStages.length, customIndex);
  }
  if (creatorPage === "manage") {
    if (renderer.hitListBack(p.x, p.y)) return "back";
    return renderer.hitStageList(p.x, p.y, manageRows().length, creatorIndex);
  }
  if (creatorPage === "packEdit") {
    if (renderer.hitPackName(p.x, p.y)) return "name";
    const foot = renderer.hitPackFooter(p.x, p.y);
    if (foot) return foot;
    return renderer.hitPackList(p.x, p.y, listAllStages().length, creatorIndex);
  }
  return null;
}

canvas.addEventListener("pointermove", (e) => {
  const p = pointerPos(e);
  menuHover = null;
  extraHover = null;
  if (screen === "menu") menuHover = renderer.hitMenu(p.x, p.y, MENU_Y, MENU_COUNT);
  else if (screen === "ask") menuHover = renderer.hitAsk(p.x, p.y);
  else if (screen === "load") {
    if (isDev()) {
      menuHover = renderer.hitStageList(p.x, p.y, LEVELS.length, loadIndex);
      if (renderer.hitListBack(p.x, p.y)) extraHover = "back";
    } else extraHover = renderer.hitLoad(p.x, p.y);
  }
  else if (screen === "tutorial") extraHover = renderer.hitTutorialNav(p.x, p.y);
  else if (screen === "settings") {
    const hit = renderer.hitSettings(p.x, p.y, settingsRows().length);
    menuHover = hit?.row ?? null;
  } else if (screen === "creatorHub") {
    if (creatorPage === "root" || creatorPage === "create" || creatorPage === "play") {
      menuHover = renderer.hitCreatorHub(p.x, p.y, creatorLabels().length);
    } else if (creatorPage === "enterCode") extraHover = renderer.hitEnterCode(p.x, p.y);
    else if (creatorPage === "offline") {
      menuHover = renderer.hitStageList(p.x, p.y, listSaved().length, customIndex);
      if (renderer.hitListBack(p.x, p.y)) extraHover = "back";
    } else if (creatorPage === "online") {
      menuHover = renderer.hitStageList(p.x, p.y, onlineStages.length, customIndex);
      if (renderer.hitListBack(p.x, p.y)) extraHover = "back";
    } else if (creatorPage === "manage") {
      menuHover = renderer.hitStageList(p.x, p.y, manageRows().length, creatorIndex);
      if (renderer.hitListBack(p.x, p.y)) extraHover = "back";
    } else if (creatorPage === "packEdit") {
      if (renderer.hitPackName(p.x, p.y)) extraHover = "name";
      menuHover = renderer.hitPackList(p.x, p.y, listAllStages().length, creatorIndex);
      extraHover = renderer.hitPackFooter(p.x, p.y) ?? extraHover;
    }
  } else if (screen === "editor") {
    extraHover = renderer.hitEditorHeader(p.x, p.y);
    menuHover = renderer.hitEditorTool(p.x, p.y, EDITOR_TOOLS.length);
  } else if (screen === "editorSave") menuHover = renderer.hitSavePrompt(p.x, p.y);
  else if (screen === "play") {
    if (showDevTools() && renderer.hitBeatTab(p.x, p.y)) extraHover = "beat";
    else if (showDevTools() && renderer.hitDevTab(p.x, p.y)) extraHover = "dev";
    else if (renderer.hitMenuTab(p.x, p.y, playMode === "editor-test" || playMode === "replay")) extraHover = "tab";
  } else if (screen === "devMenu") {
    menuHover = renderer.hitDevMenuList(p.x, p.y, LEVELS.length, loadIndex);
    extraHover = renderer.hitDevMenuFooter(p.x, p.y);
  } else if (screen === "pause") {
    if (renderer.hitMenuTab(p.x, p.y)) extraHover = "tab";
    menuHover = renderer.hitPause(p.x, p.y);
  } else if (screen === "complete") {
    const hit = renderer.hitComplete(p.x, p.y, completeShowStats, runLevels.length, completeStatsIndex);
    if (hit === "stats") extraHover = "stats";
    else if (typeof hit === "number") menuHover = hit;
  } else if (screen === "history") {
    if (renderer.hitGhostsToggle(p.x, p.y)) extraHover = "ghosts";
    else if (renderer.hitListBack(p.x, p.y)) extraHover = "back";
    else menuHover = renderer.hitStageList(p.x, p.y, historyRows().length, historyIndex);
  } else if (screen === "puzzles") {
    extraHover = null;
    if (puzzlePage === "root") menuHover = renderer.hitCreatorHub(p.x, p.y, 3);
    else if (puzzlePage === "daily") menuHover = renderer.hitCreatorHub(p.x, p.y, DIFFICULTIES.length + 1);
    else {
      if (renderer.hitPuzzlePlay(p.x, p.y)) extraHover = "play";
      else if (renderer.hitListBack(p.x, p.y)) extraHover = "back";
      else if (renderer.hitPuzzleSeed(p.x, p.y)) extraHover = "seed";
      else {
        const d = renderer.hitPuzzleDiff(p.x, p.y, true);
        const len = renderer.hitPuzzleLength(p.x, p.y, true);
        menuHover = d ?? len;
      }
    }
  }
  canvas.style.cursor = pointerOverHit(p) ? "pointer" : "default";
  if (paintHeld && screen === "editor") {
    const cell = renderer.hitEditorCell(p.x, p.y);
    if (cell && editorTool !== "link" && editorTool !== "spawn" && !(editorTool === "split" && paintState.splitStep > 0)) paintCell(cell.x, cell.y);
  }
});

window.addEventListener("keydown", onKey);

window.addEventListener("paste", (e) => {
  if (screen !== "creatorHub" || creatorPage !== "enterCode") return;
  const text = e.clipboardData?.getData("text") ?? "";
  if (!text) return;
  pasteBuf = text.trim();
  customMsg = "Code pasted. Press Enter to play.";
});

touch.addEventListener("pointerdown", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn) return;
  e.preventDefault();
  if (screen === "boot") {
    unlock();
    return;
  }
  const dir = btn.getAttribute("data-dir") as Dir | null;
  if (dir) move(dir);
  if (btn.getAttribute("data-act") === "space") swapBlock();
});

let last = now();
function frame(t: number): void {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function pollPad(): void {
  if (input.listening || input.justBound) {
    input.justBound = false;
    return;
  }
  if (screen === "boot" && (input.justPad("confirm") || input.justPad("pause"))) {
    unlock();
    return;
  }
  if (screen === "nameEntry" && (input.justPad("confirm") || input.justPad("pause"))) {
    if (nameDraft.trim()) {
      const prev = settings.playerName;
      settings.playerName = nameDraft.trim();
      persist();
      maybeDevUnlock(prev, settings.playerName);
      screen = "menu";
      sound.startMenu();
    }
    return;
  }
  if (screen === "menu") {
    if (input.justPad("down")) stepMenu(1);
    if (input.justPad("up")) stepMenu(-1);
    if (input.justPad("confirm")) chooseMenu(menuIndex);
    return;
  }
  if (screen === "pause") {
    if (input.justPad("down")) {
      pauseIndex = (pauseIndex + 1) % PAUSE_COUNT;
      sound.play("hover");
    }
    if (input.justPad("up")) {
      pauseIndex = (pauseIndex + PAUSE_COUNT - 1) % PAUSE_COUNT;
      sound.play("hover");
    }
    if (input.justPad("confirm")) choosePause(pauseIndex);
    if (input.justPad("back") || input.justPad("pause")) {
      screen = "play";
      sound.play("click");
    }
    return;
  }
  if (screen === "settings") {
    const n = settingsRows().length;
    if (input.justPad("down")) {
      settingsIndex = (settingsIndex + 1) % n;
      sound.play("hover");
    }
    if (input.justPad("up")) {
      settingsIndex = (settingsIndex + n - 1) % n;
      sound.play("hover");
    }
    if (input.justPad("left")) nudgeSetting(settingsIndex, -1);
    if (input.justPad("right")) nudgeSetting(settingsIndex, 1);
    if (input.justPad("confirm")) {
      if (settingsIndex === n - 1) {
        screen = "menu";
        persist();
        sound.play("click");
      } else if (settingsIndex === 0) {
        beginNameEdit();
        sound.play("click");
      } else if (settingsIndex >= 4) {
        input.listening = input.bindList()[settingsIndex - 4];
        input.listenKind = "pad";
      }
    }
    if (input.justPad("back")) {
      screen = "menu";
      persist();
      sound.play("click");
    }
    return;
  }
  if (screen === "creatorHub") {
    const fake = (key: string) => handleCreatorKey({ key } as KeyboardEvent);
    if (input.justPad("down")) fake("ArrowDown");
    if (input.justPad("up")) fake("ArrowUp");
    if (input.justPad("confirm")) fake("Enter");
    if (input.justPad("back")) fake("Escape");
    if (creatorPage === "packEdit" && input.justPad("pause")) fake("s");
    return;
  }
  if (screen === "play") {
    if (playMode === "replay" || autoSolve) {
      if (input.justPad("pause") || input.justPad("back")) openPause();
      return;
    }
    const dir = input.consumeMove();
    if (dir) move(dir);
    if (input.justPad("swap")) swapBlock();
    if (input.justPad("pause")) openPause();
    return;
  }
  if (screen === "history") {
    const n = historyRows().length;
    if (input.justPad("back")) {
      handleHistoryKey({ key: "Escape" } as KeyboardEvent);
    }
    if (input.justPad("down") && n) {
      historyIndex = (historyIndex + 1) % n;
      sound.play("hover");
    }
    if (input.justPad("up") && n) {
      historyIndex = (historyIndex + n - 1) % n;
      sound.play("hover");
    }
    if (input.justPad("confirm") && n) chooseHistory(historyIndex);
    if (input.justPad("swap")) {
      seeGhosts = !seeGhosts;
      saveSeeGhosts(seeGhosts);
      sound.play("click");
    }
    return;
  }
  if (screen === "puzzles") {
    handlePuzzleKey({
      key: input.justPad("down")
        ? "ArrowDown"
        : input.justPad("up")
          ? "ArrowUp"
          : input.justPad("left")
            ? "ArrowLeft"
            : input.justPad("right")
              ? "ArrowRight"
              : input.justPad("confirm")
                ? "Enter"
                : input.justPad("back")
                  ? "Escape"
                  : "",
    } as KeyboardEvent);
    return;
  }
  if (screen === "devMenu") {
    if (input.justPad("down")) {
      loadIndex = (loadIndex + 1) % LEVELS.length;
      sound.play("hover");
    }
    if (input.justPad("up")) {
      loadIndex = (loadIndex + LEVELS.length - 1) % LEVELS.length;
      sound.play("hover");
    }
    if (input.justPad("confirm")) jumpCampaign(loadIndex);
    if (input.justPad("back")) {
      screen = "play";
      sound.play("click");
    }
    return;
  }
  if (screen === "load") {
    if (input.justPad("back")) {
      screen = "menu";
      sound.play("click");
    }
    if (isDev()) {
      if (input.justPad("down")) {
        loadIndex = (loadIndex + 1) % LEVELS.length;
        sound.play("hover");
      }
      if (input.justPad("up")) {
        loadIndex = (loadIndex + LEVELS.length - 1) % LEVELS.length;
        sound.play("hover");
      }
      if (input.justPad("confirm")) jumpCampaign(loadIndex);
    }
  }
  if (screen === "complete") {
    if (input.justPad("down") && completeShowStats && runLevels.length) {
      completeStatsIndex = (completeStatsIndex + 1) % runLevels.length;
      sound.play("hover");
    } else if (input.justPad("up") && completeShowStats && runLevels.length) {
      completeStatsIndex = (completeStatsIndex + runLevels.length - 1) % runLevels.length;
      sound.play("hover");
    } else if (input.justPad("swap")) {
      completeShowStats = !completeShowStats;
      sound.play("click");
    } else if (input.justPad("back")) {
      if (completeShowStats) {
        completeShowStats = false;
        sound.play("click");
      } else leaveComplete();
    } else if (input.justPad("confirm")) {
      if (completeShowStats) {
        completeShowStats = false;
        sound.play("click");
      } else leaveComplete();
    }
    return;
  }
  if (screen === "credits" && (input.justPad("confirm") || input.justPad("back"))) {
    screen = "menu";
    sound.play("click");
    sound.startMenu();
  }
  if (screen === "tutorial") {
    if (input.justPad("right") || input.justPad("confirm")) tutorialNext();
    if (input.justPad("left")) tutorialBack();
    if (input.justPad("back")) tutorialSkip();
  }
  if (screen === "editorSave") {
    if (input.justPad("down") || input.justPad("up")) saveChoice = saveChoice === 0 ? 1 : 0;
    if (input.justPad("confirm")) chooseSave(saveChoice);
    if (input.justPad("back")) chooseSave(1);
  }
  if (screen === "editor") {
    const dir = input.consumeMove();
    if (dir) {
      moveEditorCursor(dir);
      if (input.pressed("confirm")) paintCell(editorCursor.x, editorCursor.y);
    }
    if (input.justPad("confirm")) paintCell(editorCursor.x, editorCursor.y);
    if (input.justPad("swap")) cycleEditorTool(1);
    if (input.justButton(4)) cycleEditorTool(-1);
    if (input.justButton(5)) cycleEditorTool(1);
    if (input.justPad("pause")) startEditorTest();
    if (input.justPad("back")) {
      screen = "creatorHub";
      creatorPage = "create";
      sound.play("click");
    }
    return;
  }
  if (screen === "title" && (input.justPad("confirm") || input.justPad("pause"))) enterPlay();
}

function update(dt: number): void {
  input.update(dt);
  pollPad();
  const t = now() / 1000;
  const flicker = (phase: number) => {
    const wave = 0.78 + 0.22 * Math.sin(t * 2.4 + phase);
    const buzz = Math.sin(t * 17 + phase * 3) * Math.sin(t * 4.1 + phase);
    if (buzz > 0.78) return 0.08 + 0.18 * (0.5 + 0.5 * Math.sin(t * 40));
    return wave;
  };
  logoNeonR = flicker(0.2);
  logoNeonZ = flicker(1.7);
  glitchX = Math.random() < 0.08 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  spinT += dt;
  tutorialOffset += (0 - tutorialOffset) * Math.min(1, dt * 10);
  if (screen === "pause") pauseSlide = Math.min(1, pauseSlide + dt / 0.28);

  if (screen === "author") {
    splashT += dt;
    if (splashT > 4.2) {
      advanceSplash();
    }
  }

  if ((screen === "play" || screen === "pause") && stage) {
    stage.tick(dt);
    if (pendingResult === "assemble") {
      if (stage.assemble >= 1) {
        pendingResult = null;
        stage.dropIn();
        busy = true;
        sound.play("drop_in", { volume: 0.8 });
      }
    } else if (busy && stage.anim && stage.anim.t >= stage.anim.dur) {
      const kind = stage.anim.kind;
      if (kind === "roll") {
        handlePlayResult();
        if (stage.anim?.kind === "roll") stage.anim = null;
      } else if (kind === "drop" || kind === "splitdrop") {
        stage.anim = null;
        busy = false;
        if (kind === "splitdrop") sound.play("whoosh_2");
      } else if (kind === "fall" && pendingResult === "fail") {
        stage.anim = null;
        if (playMode === "replay") {
          exitReplay();
          return;
        }
        if (autoSolve) {
          stopAutoSolve();
          playBanner = "Auto-solve failed";
        }
        if (!currentDef) return;
        const deaths = stage.attempts;
        commitAttempt(false);
        stage = new Stage(currentDef);
        stage.attempts = deaths;
        renderer.cam = fitCamera(stage);
        enterPlay();
      } else if (kind === "sink" && pendingResult === "win") {
        stage.anim = null;
        stage.beginScatter();
        pendingResult = "scatter";
        busy = true;
        sound.play("whoosh_2", { volume: 0.85 });
      }
    }
    if (pendingResult === "scatter" && stage.scatter >= 1) {
      pendingResult = null;
      afterWin();
    }
    if (screen === "play") {
      for (const ghost of ghosts) ghost.tick(dt);
      feedReplay();
    }
  }

  if (screen === "title") {
    titleT += dt;
    if (titleT > 2.4) enterPlay();
  }
}

function draw(): void {
  renderer.clear();
  const brand = brandName(screen === "nameEntry" ? nameDraft : settings.playerName);
  const drawMark = (x: number, y: number) => {
    const w = renderer.drawLogo(x, y, brand, logoNeonR, logoNeonZ, glitchX);
    renderer.drawSpinningBox(spinT, Math.min(STAGE_W - 64, x + w + 28), y + 28);
  };

  if (screen === "boot") {
    renderer.drawUiPrompt("Click or press any key to start", STAGE_W / 2, 210, "center");
    return;
  }

  if (screen === "author") {
    const fade =
      splashT < 0.28
        ? splashT / 0.28
        : splashT > 3.9
          ? Math.max(0, (4.2 - splashT) / 0.3)
          : 1;
    renderer.drawAuthorCard(fade);
    return;
  }

  if (screen === "nameEntry") {
    renderer.drawNameEntry(nameDraft, brandName(nameDraft));
    return;
  }

  if (screen === "menu" || screen === "load" || screen === "credits" || screen === "ask" || screen === "history") {
    renderer.drawBg("menu");
    drawMark(28, 110);
    if (screen === "menu" || screen === "ask") {
      renderer.drawMenuButtons(menuIndex, MENU_Y, menuHover, sound.muted, resumeAt !== null);
    }
    if (screen === "load") {
      renderer.drawLoad(
        loadCode,
        Math.min(loadCursor, 5),
        loadInvalid,
        extraHover === "enter" || extraHover === "back" ? extraHover : null,
        isDev()
          ? {
              rows: campaignRows(),
              selected: loadIndex,
              hover: extraHover === "back" ? null : menuHover,
              backHot: extraHover === "back",
            }
          : null,
      );
    }
    if (screen === "credits") renderer.drawCredits();
    if (screen === "ask") renderer.drawAskInstructions(askIndex, menuHover);
    if (screen === "history") {
      renderer.drawHistory(
        historyView === "detail" ? "Run" : "History",
        historyRows(),
        historyIndex,
        extraHover === "back" || extraHover === "ghosts" ? null : menuHover,
        seeGhosts,
        extraHover === "ghosts",
        extraHover === "back",
        "Finish campaign stages to record runs here.",
        historyView === "detail" ? "Enter replay   G ghosts" : "Enter open run   G ghosts",
      );
    }
    return;
  }

  if (screen === "settings") {
    renderer.drawBg("menu");
    const listen =
      input.listening && input.listenKind
        ? input.listenKind === "pad"
          ? "Press a controller button…"
          : "Press a keyboard key…"
        : "Shift+Enter or click right to rebind a button. Esc back.";
    renderer.drawSettingsPanel(settingsRows(), settingsIndex, listen, menuHover);
    return;
  }

  if (screen === "creatorHub") {
    renderer.drawBg("menu");
    if (creatorPage === "enterCode") {
      renderer.drawEnterCode(pasteBuf, customMsg, extraHover === "play" || extraHover === "back" ? extraHover : null);
    } else if (creatorPage === "offline") {
      renderer.drawStageList(
        "Offline",
        listSaved().map((s) => `${s.name}  ·  ${s.author}`),
        customIndex,
        extraHover === "back" ? null : menuHover,
        "Enter play",
        "No local stages yet.",
        extraHover === "back",
      );
    } else if (creatorPage === "online") {
      renderer.drawStageList(
        "Online",
        onlineStages.map((s) => `${s.name}  ·  ${s.author}`),
        customIndex,
        extraHover === "back" ? null : menuHover,
        onlineStatus || "Enter play (also saves a download)",
        onlineStatus || "No community stages yet.",
        extraHover === "back",
      );
    } else if (creatorPage === "manage") {
      renderer.drawStageList(
        "Manage",
        manageRows().map((r) => r.label),
        creatorIndex,
        extraHover === "back" ? null : menuHover,
        "Enter open / play pack   Del delete",
        "No saved stages.",
        extraHover === "back",
      );
    } else if (creatorPage === "packEdit") {
      renderer.drawPackEdit(
        packDraft.name,
        listAllStages().map((s) => ({ label: `${s.name}  ·  ${s.author}`, on: packDraft.codes.includes(s.code) })),
        creatorIndex,
        menuHover,
        extraHover === "name" || packNameFocus,
        extraHover === "save" || extraHover === "back" ? extraHover : null,
      );
    } else {
      renderer.drawCreatorHub(creatorTitle(), creatorLabels(), creatorIndex, menuHover);
    }
    return;
  }

  if (screen === "puzzles") {
    renderer.drawBg("menu");
    if (puzzlePage === "root") {
      renderer.drawCreatorHub("Puzzles", puzzleLabels(), puzzleIndex, menuHover);
    } else if (puzzlePage === "daily") {
      const d = new Date();
      const stamp = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      renderer.drawCreatorHub(`Daily  ·  ${stamp}`, puzzleLabels(), puzzleIndex, menuHover);
    } else {
      renderer.drawPuzzleSetup(
        "Seeded Run",
        puzzleMsg || "Same seed always builds the same stages.",
        puzzleSeedFocus ? `${puzzleSeed}_` : puzzleSeed,
        DIFFICULTIES.map(difficultyLabel),
        DIFFICULTIES.indexOf(puzzleDiff),
        RUN_LENGTHS.map((n) => (n === 1 ? "1 stage" : `${n} stages`)),
        Math.max(0, RUN_LENGTHS.indexOf(puzzleLength as (typeof RUN_LENGTHS)[number])),
        true,
        true,
        puzzleFocus,
        extraHover === "play" || extraHover === "back" || extraHover === "seed" ? extraHover : null,
      );
    }
    return;
  }

  if (screen === "editor") {
    renderer.drawBg("menu");
    renderer.drawEditor(
      draft.tiles,
      draft.spawn,
      EDITOR_TOOLS.find((t) => t.id === editorTool)?.label ?? editorTool,
      EDITOR_TOOLS.map((t) => t.label),
      editorHint,
      editorName,
      editorNameFocus,
      editorCursor,
      extraHover === "test" || extraHover === "back" ? extraHover : null,
      menuHover,
      stageId(draft),
      beatStatus,
      splitMarks(draft),
    );
    return;
  }

  if (screen === "editorSave") {
    renderer.drawBg("menu");
    renderer.drawSavePrompt(shareCode, saveMsg || editorName, menuHover, stageId(draft));
    return;
  }

  if (screen === "tutorial") {
    renderer.drawTutorial(tutorialSlide, tutorialOffset, extraHover === "back" || extraHover === "next" || extraHover === "skip" ? extraHover : null);
    return;
  }

  if (screen === "title") {
    const fade = titleT < 0.3 ? titleT / 0.3 : titleT > 2.1 ? (2.4 - titleT) / 0.3 : 1;
    const shake = {
      x: Math.random() < 0.08 ? (Math.random() < 0.5 ? -2 : 2) : 0,
      y: Math.random() < 0.05 ? -1 : 0,
    };
    renderer.drawTitle(currentTitle || `STAGE ${String(levelIndex + 1).padStart(2, "0")}`, Math.max(0, Math.min(1, fade)), shake, currentAuthor || undefined);
    return;
  }

  if (screen === "complete") {
    const hover =
      extraHover === "stats" || extraHover === "back"
        ? extraHover
        : menuHover;
    renderer.drawComplete(
      sessionMoves,
      formatTime(sessionTimeMs || now() - sessionStart),
      sessionFails,
      completeShowStats,
      runLevels.map(levelStatLabel),
      completeStatsIndex,
      hover,
    );
    return;
  }

  if ((screen === "play" || screen === "pause" || screen === "devMenu") && stage) {
    renderer.drawBg("level");
    renderer.drawLevel(stage, playMode === "replay" ? ghosts.map((g) => g.stage) : []);
    const hud = hudCode();
    renderer.drawHud(
      hud.value,
      stage.moves,
      playMode === "editor-test" ? "Back to Editor" : playMode === "replay" ? "Exit" : "Menu",
      extraHover === "tab",
      showDevTools(),
      extraHover === "dev",
      playMode === "replay" || autoSolve,
      !!stage.split,
      showDevTools(),
      extraHover === "beat",
      playBanner,
      hud.label,
    );
    if (screen === "pause") {
      renderer.drawPause(
        pauseIndex,
        formatTime(now() - sessionStart),
        playMode === "campaign" ? levelIndex : 0,
        stage.attempts,
        sound.muted,
        pauseSlide,
        extraHover === "tab" ? -1 : menuHover,
      );
    }
    if (screen === "devMenu") {
      renderer.drawDevMenu(
        campaignRows(),
        loadIndex,
        extraHover === "next" || extraHover === "prev" || extraHover === "win" || extraHover === "close" ? null : menuHover,
        extraHover === "next" || extraHover === "prev" || extraHover === "win" || extraHover === "close" ? extraHover : null,
      );
    }
  }
}

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load("700 15px Orbitron"),
    document.fonts.load("500 13px Orbitron"),
    document.fonts.load("500 12px Orbitron"),
  ]).catch(() => undefined);
  const assets = await loadAssets();
  renderer = new Renderer(canvas, assets);
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", brandName(settings.playerName));
  applyBrand();
  await sound.load();
  sound.setMix(settings.sfx, settings.music);
  requestAnimationFrame(frame);
}

void boot();
