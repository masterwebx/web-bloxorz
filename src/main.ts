import { loadAssets, STAGE_H, STAGE_W } from "./assets";
import { SoundBank } from "./audio";
import {
  decodeLevel,
  deleteStage,
  emptyDraft,
  encodeLevel,
  isPlayable,
  listSaved,
  saveStage,
  setTile,
  tileChar,
  type SavedStage,
} from "./customLevels";
import { LEVELS, Stage, levelByCode, type Dir } from "./engine";
import { Input } from "./input";
import { Renderer, fitCamera, formatTime, MENU_COUNT, MENU_Y, PAUSE_COUNT } from "./render";
import { ACTION_LABEL, loadSettings, saveSettings, type Action, type Settings } from "./settings";
import type { LevelDef, SwitchMode } from "./levels";

type Screen =
  | "boot"
  | "author"
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
  | "customPlay"
  | "editorSave";

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
let logoFrame = 5;
let logoTick = 0;
let glitchX = 0;
let sessionMoves = 0;
let sessionFails = 0;
let sessionStart = 0;
let pendingResult: "ok" | "fail" | "win" | "split" | "assemble" | "scatter" | null = null;
let busy = false;
let splashT = 0;
let askIndex = 0;
let spinFrame = 0;
let spinTick = 0;
let resumeAt: number | null = null;
let playMode: PlayMode = "campaign";
let currentDef: LevelDef | null = null;
let settingsIndex = 0;
let creatorIndex = 0;
let draft: LevelDef = emptyDraft();
let editorName = "My Stage";
let editorTool = "stone";
let editorHint = "Paint tiles, then Test. You must beat a stage to save it.";
let linkFrom: { x: number; y: number } | null = null;
let splitStep: 0 | 1 | 2 = 0;
let splitAt: { x: number; y: number } | null = null;
let paintHeld = false;
let customIndex = 0;
let pasteBuf = "";
let customMsg = "Paste a BX1 share code, or pick a saved stage.";
let saveChoice = 0;
let saveMsg = "";
let shareCode = "";

function now(): number {
  return performance.now();
}

function persist(): void {
  saveSettings(settings);
  sound.setMix(settings.sfx, settings.music);
}

function settingsRows(): { label: string; value: string }[] {
  const rows = [
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
  beginFromDef(LEVELS[index], withTitle);
}

function beginFromDef(def: LevelDef, withTitle: boolean): void {
  currentDef = cloneDef(def);
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
  if (e.key === "m" || e.key === "M") {
    const muted = sound.toggleMute();
    if (!muted) {
      if (screen === "play" || screen === "pause") sound.startAmbient();
      else sound.startMenu();
    }
    return;
  }

  if (screen === "menu") {
    if (e.key === "ArrowDown") {
      menuIndex = (menuIndex + 1) % MENU_COUNT;
      sound.play("hover");
    } else if (e.key === "ArrowUp") {
      menuIndex = (menuIndex + MENU_COUNT - 1) % MENU_COUNT;
      sound.play("hover");
    } else if (confirmKey(e.key)) {
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
    if (e.key === "ArrowDown") {
      creatorIndex = (creatorIndex + 1) % 3;
      sound.play("hover");
    } else if (e.key === "ArrowUp") {
      creatorIndex = (creatorIndex + 2) % 3;
      sound.play("hover");
    } else if (confirmKey(e.key)) chooseCreator(creatorIndex);
    else if (backKey(e.key)) {
      screen = "menu";
      sound.play("click");
    }
    return;
  }

  if (screen === "editor") {
    if (backKey(e.key)) {
      screen = "creatorHub";
      sound.play("click");
      return;
    }
    if (e.key === "Enter") startEditorTest();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const i = EDITOR_TOOLS.findIndex((t) => t.id === editorTool);
      const next = e.key === "ArrowDown" ? i + 1 : i - 1;
      const tool = EDITOR_TOOLS[(next + EDITOR_TOOLS.length) % EDITOR_TOOLS.length];
      editorTool = tool.id;
      sound.play("hover");
    }
    return;
  }

  if (screen === "customPlay") {
    if (backKey(e.key)) {
      screen = "creatorHub";
      sound.play("click");
      return;
    }
    const saved = listSaved();
    if (e.key === "ArrowDown" && saved.length) {
      customIndex = (customIndex + 1) % saved.length;
      sound.play("hover");
    } else if (e.key === "ArrowUp" && saved.length) {
      customIndex = (customIndex + saved.length - 1) % saved.length;
      sound.play("hover");
    } else if (e.key === "Enter") {
      if (pasteBuf.trim().startsWith("BX1")) tryPastePlay();
      else if (saved[customIndex]) playSaved(saved[customIndex]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (pasteBuf && e.key === "Backspace") {
        pasteBuf = pasteBuf.slice(0, -1);
        return;
      }
      if (saved[customIndex]) {
        deleteStage(saved[customIndex].code);
        customMsg = "Deleted.";
        customIndex = 0;
        sound.play("click");
      }
    } else if (e.key === "c" && (e.ctrlKey || e.metaKey) && saved[customIndex]) {
      void navigator.clipboard?.writeText(saved[customIndex].def ? encodeLevel(saved[customIndex].def) : "");
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      pasteBuf += e.key;
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
    if (settingsIndex >= 3 && settingsIndex < last) {
      const action = input.bindList()[settingsIndex - 3];
      input.listening = action;
      input.listenKind = e.shiftKey ? "pad" : "key";
      sound.play("click");
    } else if (settingsIndex === 2) {
      nudgeSetting(2, 1);
    }
  }
}

function nudgeSetting(row: number, dir: number): void {
  if (row === 0) {
    settings.music = Math.max(0, Math.min(1, settings.music + dir * 0.05));
    persist();
    sound.play("hover");
  } else if (row === 1) {
    settings.sfx = Math.max(0, Math.min(1, settings.sfx + dir * 0.05));
    persist();
    sound.play("hover");
  } else if (row === 2) {
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
    else if (playMode === "custom") screen = "customPlay";
    else {
      resumeAt = levelIndex;
      screen = "menu";
    }
  }
}

function chooseCreator(i: number): void {
  sound.play("click");
  if (i === 0) {
    draft = emptyDraft();
    editorName = "My Stage";
    editorTool = "stone";
    editorHint = "Paint tiles, then Test. You must beat a stage to save it.";
    linkFrom = null;
    splitStep = 0;
    screen = "editor";
  } else if (i === 1) {
    customIndex = 0;
    pasteBuf = "";
    customMsg = "Paste a BX1 share code, or pick a saved stage.";
    screen = "customPlay";
  } else {
    screen = "menu";
  }
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
    setTile(draft, x, y, tool.ch);
    if (tool.ch === " ") {
      draft.switches = draft.switches.filter((s) => !(s.x === x && s.y === y));
      draft.splits = draft.splits.filter((s) => !(s.x === x && s.y === y));
    }
  }
}

function playSaved(item: SavedStage): void {
  sound.play("click");
  playMode = "custom";
  editorName = item.name;
  beginFromDef(item.def, false);
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
  beginFromDef(def, false);
}

function chooseSave(i: number): void {
  if (i === 0) {
    const name = editorName.trim() || "My Stage";
    const code = encodeLevel(draft);
    saveStage({ name, code, def: cloneDef(draft) });
    void navigator.clipboard?.writeText(code);
    shareCode = code;
    saveMsg = "Saved and copied to clipboard.";
    sound.play("click");
    screen = "creatorHub";
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
  screen = "menu";
  sound.startMenu();
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
    screen = "customPlay";
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
    if (p.y > STAGE_H - 48 && p.x < 180) {
      screen = "menu";
      sound.play("click");
      return;
    }
    if (p.y > 280 && p.y < 330) tryLoad();
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
      } else if (hit.row <= 2) {
        nudgeSetting(hit.row, hit.side === "right" ? 1 : -1);
      } else {
        const action = input.bindList()[hit.row - 3];
        input.listening = action;
        input.listenKind = hit.side === "right" ? "pad" : "key";
        sound.play("click");
      }
    }
    return;
  }
  if (screen === "creatorHub") {
    const hit = renderer.hitCreatorHub(p.x, p.y);
    if (hit !== null) {
      creatorIndex = hit;
      chooseCreator(hit);
    }
    return;
  }
  if (screen === "editor") {
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
  if (screen === "customPlay") {
    if (p.y > STAGE_H - 36) {
      screen = "creatorHub";
      sound.play("click");
      return;
    }
    const saved = listSaved();
    if (p.y >= 148 && p.y < 148 + saved.length * 22) {
      const i = Math.max(0, Math.min(saved.length - 1, Math.floor((p.y - 148) / 22)));
      customIndex = i;
      playSaved(saved[i]);
    }
    return;
  }
  if (screen === "editorSave") {
    const hit = renderer.hitSavePrompt(p.x, p.y);
    if (hit !== null) chooseSave(hit);
    return;
  }
  if (screen === "play") {
    if (renderer.hitMenuTab(p.x, p.y)) openPause();
  }
});

canvas.addEventListener("pointerup", () => {
  paintHeld = false;
});

canvas.addEventListener("pointermove", (e) => {
  const p = pointerPos(e);
  if (screen === "menu") menuHover = renderer.hitMenu(p.x, p.y, MENU_Y, MENU_COUNT);
  else if (screen === "ask") menuHover = renderer.hitAsk(p.x, p.y);
  else menuHover = null;
  const overUi =
    screen === "play"
      ? renderer.hitMenuTab(p.x, p.y)
      : screen !== "boot" && screen !== "author" && screen !== "title";
  canvas.style.cursor = overUi ? "pointer" : "default";
  if (paintHeld && screen === "editor") {
    const cell = renderer.hitEditorCell(p.x, p.y);
    if (cell && editorTool !== "link" && editorTool !== "spawn") paintCell(cell.x, cell.y);
  }
});

window.addEventListener("keydown", onKey);

window.addEventListener("paste", (e) => {
  if (screen !== "customPlay") return;
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
  if (screen === "menu") {
    if (input.justPad("down")) {
      menuIndex = (menuIndex + 1) % MENU_COUNT;
      sound.play("hover");
    }
    if (input.justPad("up")) {
      menuIndex = (menuIndex + MENU_COUNT - 1) % MENU_COUNT;
      sound.play("hover");
    }
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
      } else if (settingsIndex >= 3) {
        input.listening = input.bindList()[settingsIndex - 3];
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
    if (input.justPad("down")) {
      creatorIndex = (creatorIndex + 1) % 3;
      sound.play("hover");
    }
    if (input.justPad("up")) {
      creatorIndex = (creatorIndex + 2) % 3;
      sound.play("hover");
    }
    if (input.justPad("confirm")) chooseCreator(creatorIndex);
    if (input.justPad("back")) {
      screen = "menu";
      sound.play("click");
    }
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
  if (screen === "customPlay") {
    const saved = listSaved();
    if (input.justPad("down") && saved.length) customIndex = (customIndex + 1) % saved.length;
    if (input.justPad("up") && saved.length) customIndex = (customIndex + saved.length - 1) % saved.length;
    if (input.justPad("confirm") && saved[customIndex]) playSaved(saved[customIndex]);
    if (input.justPad("back")) {
      screen = "creatorHub";
      sound.play("click");
    }
  }
  if (screen === "editor") {
    if (input.justPad("confirm")) startEditorTest();
    if (input.justPad("back")) {
      screen = "creatorHub";
      sound.play("click");
    }
  }
  if (screen === "title" && (input.justPad("confirm") || input.justPad("pause"))) enterPlay();
}

function update(dt: number): void {
  input.update(dt);
  pollPad();
  logoTick += dt;
  if (logoTick > 0.12) {
    logoTick = 0;
    if (Math.random() < 0.18) logoFrame = Math.max(0, Math.min(5, logoFrame + (Math.random() < 0.5 ? -1 : 1)));
    else logoFrame = Math.min(5, logoFrame + (logoFrame < 5 ? 1 : 0));
    glitchX = Math.random() < 0.12 ? (Math.random() < 0.5 ? -2 : 2) : 0;
  }
  spinTick += dt;
  if (spinTick > 0.09) {
    spinTick = 0;
    spinFrame = (spinFrame + 1) % 9;
  }
  tutorialOffset += (0 - tutorialOffset) * Math.min(1, dt * 10);
  if (screen === "pause") pauseSlide = Math.min(1, pauseSlide + dt / 0.28);

  if (screen === "author") {
    splashT += dt;
    if (splashT > 4.2) {
      screen = "menu";
      sound.startMenu();
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
        sound.play("whoosh", { volume: 0.85 });
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
  if (screen === "boot") {
    renderer.drawBg("menu");
    renderer.drawLogo(5, 36, 52);
    renderer.drawUiPrompt("Click or press any key to start", 42, 300);
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

  if (screen === "menu" || screen === "load" || screen === "credits" || screen === "ask") {
    renderer.drawBg("menu");
    renderer.drawLogo(logoFrame, 32, 48, glitchX);
    renderer.drawSpinBlock(spinFrame, 308, 92);
    if (screen === "menu" || screen === "ask") {
      renderer.drawMenuButtons(menuIndex, MENU_Y, menuHover, sound.muted, resumeAt !== null);
    }
    if (screen === "load") renderer.drawLoad(loadCode, Math.min(loadCursor, 5), loadInvalid);
    if (screen === "credits") renderer.drawCredits();
    if (screen === "ask") renderer.drawAskInstructions(askIndex);
    return;
  }

  if (screen === "settings") {
    renderer.drawBg("menu");
    const listen =
      input.listening && input.listenKind
        ? input.listenKind === "pad"
          ? "Press a controller button…"
          : "Press a keyboard key…"
        : "Left / Right change values. Enter rebinds a key. Shift+Enter or click right to rebind a button.";
    renderer.drawSettingsPanel(settingsRows(), settingsIndex, listen);
    return;
  }

  if (screen === "creatorHub") {
    renderer.drawBg("menu");
    renderer.drawCreatorHub(creatorIndex);
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
    );
    return;
  }

  if (screen === "customPlay") {
    renderer.drawBg("menu");
    renderer.drawCustomPlay(
      listSaved().map((s) => s.name),
      customIndex,
      pasteBuf,
      customMsg,
    );
    return;
  }

  if (screen === "editorSave") {
    renderer.drawBg("menu");
    renderer.drawSavePrompt(shareCode, saveMsg || editorName);
    return;
  }

  if (screen === "tutorial") {
    renderer.drawTutorial(tutorialSlide, tutorialOffset);
    return;
  }

  if (screen === "title") {
    const fade = titleT < 0.3 ? titleT / 0.3 : titleT > 2.1 ? (2.4 - titleT) / 0.3 : 1;
    const shake = {
      x: Math.random() < 0.08 ? (Math.random() < 0.5 ? -2 : 2) : 0,
      y: Math.random() < 0.05 ? -1 : 0,
    };
    renderer.drawTitle(levelIndex, Math.max(0, Math.min(1, fade)), shake);
    return;
  }

  if (screen === "complete") {
    renderer.drawComplete(sessionMoves, formatTime(now() - sessionStart), sessionFails);
    return;
  }

  if ((screen === "play" || screen === "pause") && stage) {
    renderer.drawBg("level");
    renderer.drawLevel(stage);
    renderer.drawHud(stage.def.code, stage.moves);
    if (screen === "pause") {
      renderer.drawPause(
        pauseIndex,
        formatTime(now() - sessionStart),
        playMode === "campaign" ? levelIndex : 0,
        stage.attempts,
        sound.muted,
        pauseSlide,
      );
    }
  }
}

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load("700 15px Orbitron"),
    document.fonts.load("500 13px Orbitron"),
  ]).catch(() => undefined);
  const assets = await loadAssets();
  renderer = new Renderer(canvas, assets);
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Bloxorz");
  await sound.load();
  sound.setMix(settings.sfx, settings.music);
  requestAnimationFrame(frame);
}

void boot();
