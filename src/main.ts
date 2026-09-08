import { loadAssets, STAGE_H, STAGE_W } from "./assets";
import { SoundBank } from "./audio";
import {
  decodeLevel,
  deletePack,
  deleteStage,
  emptyDraft,
  encodeLevel,
  isPlayable,
  listAllStages,
  listDownloaded,
  listPacks,
  listSaved,
  packStages,
  savePack,
  saveStage,
  setTile,
  tileChar,
  type SavedStage,
  type StagePack,
} from "./customLevels";
import { fetchOnlineStages } from "./community";
import { LEVELS, Stage, levelByCode, type Dir } from "./engine";
import { Input } from "./input";
import { Renderer, fitCamera, formatTime, MENU_COUNT, MENU_Y, PAUSE_COUNT } from "./render";
import { ACTION_LABEL, brandName, loadSettings, saveSettings, type Action, type Settings } from "./settings";
import type { LevelDef, SwitchMode } from "./levels";

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
  | "settings"
  | "creatorHub"
  | "editor"
  | "editorSave";

type CreatorPage = "root" | "create" | "play" | "enterCode" | "offline" | "online" | "manage" | "packEdit";

type PlayMode = "campaign" | "custom" | "editor-test";

const EDITOR_TOOLS = [
  { id: "erase", label: "Erase", ch: " " },
  { id: "stone", label: "Stone", ch: "b" },
  { id: "exit", label: "Exit", ch: "e" },
  { id: "soft", label: "Soft Sw.", ch: "s" },
  { id: "heavy", label: "Heavy Sw.", ch: "h" },
  { id: "fragile", label: "Fragile", ch: "f" },
  { id: "split", label: "Split", ch: "v" },
  { id: "bridgeL", label: "Bridge L", ch: "l" },
  { id: "bridgeR", label: "Bridge R", ch: "r" },
  { id: "spawn", label: "Spawn", ch: null },
  { id: "link", label: "Link Sw.", ch: null },
] as const;

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
let creatorIndex = 0;
let creatorPage: CreatorPage = "root";
let draft: LevelDef = emptyDraft();
let editorName = "My Stage";
let editorNameFocus = false;
let editorTool = "stone";
let editorHint = "Arrows move the cursor. Confirm paints. [ ] cycle tools.";
let editorCursor = { x: 2, y: 4 };
let linkFrom: { x: number; y: number } | null = null;
let splitStep: 0 | 1 | 2 = 0;
let splitAt: { x: number; y: number } | null = null;
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
type ExtraHover = "enter" | "back" | "play" | "test" | "skip" | "next" | "tab" | "save" | "name" | null;
let extraHover: ExtraHover = null;

function now(): number {
  return performance.now();
}

function persist(): void {
  saveSettings(settings);
  sound.setMix(settings.sfx, settings.music);
  applyBrand();
}

function player(): string {
  return settings.playerName.trim() || "Player";
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
  for (const s of listSaved()) rows.push({ label: `Local · ${s.name}  (${s.author})`, kind: "stage", stage: s });
  for (const s of listDownloaded()) rows.push({ label: `Downloaded · ${s.name}  (${s.author})`, kind: "stage", stage: s });
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
  sessionMoves = 0;
  sessionFails = 0;
  sessionStart = now();
}

function beginCampaign(index: number, withTitle: boolean): void {
  levelIndex = index;
  if (index >= LEVELS.length) {
    screen = "complete";
    sound.stopAmbient();
    sound.startMenu();
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
  if (!stage.tryMove(dir)) return;
  input.rumble(90, 0.42, 0.62);
  busy = true;
  pendingResult = null;
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

  sessionMoves += 1;
  if (result === "win") {
    sound.play("whoosh", { volume: 0.95 });
    input.rumble(220, 0.45, 0.4);
    stage.beginSink();
    busy = true;
    pendingResult = "win";
    return;
  }
  if (result === "fail") {
    sessionFails++;
    stage.attempts++;
    sound.play("fail");
    input.rumble(340, 0.85, 0.7);
    stage.beginFall();
    busy = true;
    pendingResult = "fail";
    return;
  }
  if (result === "split") {
    stage.beginSplit();
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
  if (screen === "creatorHub" && (creatorPage === "enterCode" || packNameFocus)) return true;
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
        settings.playerName = nameDraft.trim();
        persist();
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
    if (confirmKey(e.key)) {
      screen = "menu";
      sound.play("click");
      sound.startMenu();
    }
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
    const dir = keyDir(e.key);
    if (dir) {
      e.preventDefault();
      move(dir);
      return;
    }
    if (matchesAction(e.key, "swap") || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      stage?.swapSplit();
      sound.play("click", { volume: 0.5 });
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
      settingsNameFocus = false;
      persist();
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
      settingsNameFocus = true;
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
  sound.play("click");
  startSession();
  beginCampaign(i, true);
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
    screen = "load";
  } else if (i === 3) {
    creatorIndex = 0;
    creatorPage = "root";
    screen = "creatorHub";
  } else if (i === 4) {
    settingsIndex = 0;
    screen = "settings";
  } else if (i === 5) {
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
    sound.startMenu();
    if (playMode === "editor-test") screen = "editor";
    else if (playMode === "custom") {
      screen = "creatorHub";
      creatorPage = customQueue.length > 1 ? "manage" : "offline";
    }
    else {
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
        screen = "editor";
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
      customMsg = "Paste or type a BX1 share code.";
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
  linkFrom = null;
  splitStep = 0;
  screen = "editor";
}

function cycleEditorTool(dir: number): void {
  const i = EDITOR_TOOLS.findIndex((t) => t.id === editorTool);
  const tool = EDITOR_TOOLS[(i + dir + EDITOR_TOOLS.length) % EDITOR_TOOLS.length];
  editorTool = tool.id;
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
  const tool = EDITOR_TOOLS.find((t) => t.id === editorTool);
  if (!tool) return;
  if (tool.id === "spawn") {
    draft.spawn = [x, y];
    editorHint = "Spawn set.";
    return;
  }
  if (tool.id === "link") {
    const ch = tileChar(draft, x, y);
    if (ch === "s" || ch === "h") {
      linkFrom = { x, y };
      editorHint = "Now click a bridge to link. Click again to cycle On / Off / Toggle.";
      return;
    }
    if (!linkFrom) {
      editorHint = "Click a soft or heavy switch first.";
      return;
    }
    if (ch !== "l" && ch !== "r" && ch !== "k" && ch !== "q") {
      editorHint = "Link target must be a bridge.";
      return;
    }
    const from = linkFrom;
    let sw = draft.switches.find((s) => s.x === from.x && s.y === from.y);
    if (!sw) {
      sw = { x: from.x, y: from.y, bridges: [] };
      draft.switches.push(sw);
    }
    const existing = sw.bridges.find((b) => b.x === x && b.y === y);
    const cycle: SwitchMode[] = ["onoff", "on", "off"];
    if (existing) {
      existing.mode = cycle[(cycle.indexOf(existing.mode) + 1) % 3];
      editorHint = `Bridge link set to ${existing.mode}.`;
    } else {
      sw.bridges.push({ x, y, mode: "onoff" });
      editorHint = "Bridge linked (toggle). Click again to change mode.";
    }
    return;
  }
  if (tool.ch === "v") {
    setTile(draft, x, y, "v");
    splitAt = { x, y };
    splitStep = 1;
    editorHint = "Click destination for cube A.";
    return;
  }
  if (tool.ch !== null) {
    if (splitStep === 1 && splitAt) {
      const at = splitAt;
      const pad = draft.splits.find((s) => s.x === at.x && s.y === at.y);
      if (pad) pad.a = [x, y];
      else draft.splits.push({ x: at.x, y: at.y, a: [x, y], b: [x, y] });
      splitStep = 2;
      editorHint = "Click destination for cube B.";
      return;
    }
    if (splitStep === 2 && splitAt) {
      const at = splitAt;
      let pad = draft.splits.find((s) => s.x === at.x && s.y === at.y);
      if (!pad) {
        pad = { x: at.x, y: at.y, a: [x, y], b: [x, y] };
        draft.splits.push(pad);
      }
      pad.b = [x, y];
      splitStep = 0;
      splitAt = null;
      editorHint = "Split destinations set.";
      return;
    }
    if (tool.ch === "e") {
      for (let yy = 0; yy < 10; yy++) {
        for (let xx = 0; xx < 15; xx++) {
          if (tileChar(draft, xx, yy) === "e") setTile(draft, xx, yy, " ");
        }
      }
      setTile(draft, x, y, "e");
      editorHint = "Exit set. Only one exit can be placed.";
      return;
    }
    setTile(draft, x, y, tool.ch);
    if (tool.ch === " ") {
      draft.switches = draft.switches.filter((s) => !(s.x === x && s.y === y));
      draft.splits = draft.splits.filter((s) => !(s.x === x && s.y === y));
    }
  }
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

function tryPastePlay(): void {
  const def = decodeLevel(pasteBuf);
  if (!def) {
    customMsg = "That code is not a valid stage.";
    sound.play("fail");
    return;
  }
  sound.play("click");
  playMode = "custom";
  customOrigin = "enterCode";
  beginFromDef(def, true, "Shared Stage", "by share code");
}

function chooseSave(i: number): void {
  if (i === 0) {
    const name = editorName.trim() || "My Stage";
    const code = encodeLevel(draft);
    saveStage({ name, author: player(), code, def: cloneDef(draft), source: "local" });
    void navigator.clipboard?.writeText(code);
    shareCode = code;
    saveMsg = "Saved and copied to clipboard.";
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
  sessionFails++;
  stage = new Stage(currentDef);
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
    const hit = renderer.hitLoad(p.x, p.y);
    if (hit === "back") {
      screen = "menu";
      sound.play("click");
      return;
    }
    if (hit === "enter") tryLoad();
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
    screen = "menu";
    sound.play("click");
    sound.startMenu();
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
        settingsNameFocus = true;
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
    if (renderer.hitMenuTab(p.x, p.y, playMode === "editor-test")) {
      if (playMode === "editor-test") {
        screen = "editor";
        sound.play("click");
        sound.startMenu();
        return;
      }
      openPause();
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
      return renderer.hitLoad(p.x, p.y) !== null;
    case "tutorial": {
      const nav = renderer.hitTutorialNav(p.x, p.y);
      if (nav === "back" && tutorialSlide === 0) return false;
      return nav !== null;
    }
    case "play":
      return renderer.hitMenuTab(p.x, p.y, playMode === "editor-test");
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
  else if (screen === "load") extraHover = renderer.hitLoad(p.x, p.y);
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
    if (renderer.hitMenuTab(p.x, p.y, playMode === "editor-test")) extraHover = "tab";
  } else if (screen === "pause") {
    if (renderer.hitMenuTab(p.x, p.y)) extraHover = "tab";
    menuHover = renderer.hitPause(p.x, p.y);
  }
  canvas.style.cursor = pointerOverHit(p) ? "pointer" : "default";
  if (paintHeld && screen === "editor") {
    const cell = renderer.hitEditorCell(p.x, p.y);
    if (cell && editorTool !== "link" && editorTool !== "spawn") paintCell(cell.x, cell.y);
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
  if (btn.getAttribute("data-act") === "space") stage?.swapSplit();
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
      settings.playerName = nameDraft.trim();
      persist();
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
        settingsNameFocus = true;
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
    const dir = input.consumeMove();
    if (dir) move(dir);
    if (input.justPad("swap")) {
      stage?.swapSplit();
      sound.play("click", { volume: 0.5 });
    }
    if (input.justPad("pause")) openPause();
    return;
  }
  if (screen === "load" && input.justPad("back")) {
    screen = "menu";
    sound.play("click");
  }
  if ((screen === "credits" || screen === "complete") && (input.justPad("confirm") || input.justPad("back"))) {
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
        if (!currentDef) return;
        stage = new Stage(currentDef);
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

  if (screen === "menu" || screen === "load" || screen === "credits" || screen === "ask") {
    renderer.drawBg("menu");
    drawMark(28, 110);
    if (screen === "menu" || screen === "ask") {
      renderer.drawMenuButtons(menuIndex, MENU_Y, menuHover, sound.muted, resumeAt !== null);
    }
    if (screen === "load") renderer.drawLoad(loadCode, Math.min(loadCursor, 5), loadInvalid, extraHover === "enter" || extraHover === "back" ? extraHover : null);
    if (screen === "credits") renderer.drawCredits();
    if (screen === "ask") renderer.drawAskInstructions(askIndex, menuHover);
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
    );
    return;
  }

  if (screen === "editorSave") {
    renderer.drawBg("menu");
    renderer.drawSavePrompt(shareCode, saveMsg || editorName, menuHover);
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
    renderer.drawComplete(sessionMoves, formatTime(now() - sessionStart), sessionFails);
    return;
  }

  if ((screen === "play" || screen === "pause") && stage) {
    renderer.drawBg("level");
    renderer.drawLevel(stage);
    renderer.drawHud(
      stage.def.code,
      stage.moves,
      playMode === "editor-test" ? "Back to Editor" : "Menu",
      extraHover === "tab",
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
