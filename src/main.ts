import { loadAssets, STAGE_H, STAGE_W } from "./assets";
import { SoundBank } from "./audio";
import { LEVELS, Stage, levelByCode, type Dir } from "./engine";
import { Renderer, fitCamera, formatTime } from "./render";

type Screen =
  | "boot"
  | "menu"
  | "load"
  | "credits"
  | "tutorial"
  | "title"
  | "play"
  | "pause"
  | "complete";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const touch = document.querySelector<HTMLElement>("#touch")!;

const sound = new SoundBank();
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
let levelIndex = 0;
let stage: Stage | null = null;
let titleT = 0;
let logoFrame = 5;
let logoTick = 0;
let glitchX = 0;
let sessionMoves = 0;
let sessionFails = 0;
let sessionStart = 0;
let pendingResult: "ok" | "fail" | "win" | "split" | null = null;
let busy = false;

function now(): number {
  return performance.now();
}

function startSession(): void {
  sessionMoves = 0;
  sessionFails = 0;
  sessionStart = now();
}

function beginLevel(index: number, withTitle: boolean): void {
  levelIndex = index;
  if (index >= LEVELS.length) {
    screen = "complete";
    sound.stopAmbient();
    sound.startMenu();
    return;
  }
  stage = new Stage(LEVELS[index]);
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
  stage.dropIn();
  busy = true;
  pendingResult = null;
  canvas.focus();
  sound.startAmbient();
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
    if (opened || closed) sound.play("hover", { volume: 0.5 });
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
    sound.play("whoosh");
    stage.beginSink();
    busy = true;
    pendingResult = "win";
    return;
  }
  if (result === "fail") {
    sessionFails++;
    stage.attempts++;
    sound.play("fail");
    stage.beginFall();
    busy = true;
    pendingResult = "fail";
    return;
  }
  if (result === "split") {
    sound.play("whoosh");
    stage.beginSplit();
    busy = true;
    pendingResult = "split";
    return;
  }
  busy = false;
  pendingResult = null;
}

function keyDir(key: string): Dir | null {
  if (key === "ArrowUp" || key === "w" || key === "W") return "up";
  if (key === "ArrowDown" || key === "s" || key === "S") return "down";
  if (key === "ArrowLeft" || key === "a" || key === "A") return "left";
  if (key === "ArrowRight" || key === "d" || key === "D") return "right";
  return null;
}

function onKey(e: KeyboardEvent): void {
  if (e.repeat && screen === "play") return;
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
      menuIndex = (menuIndex + 1) % 3;
      sound.play("hover");
    } else if (e.key === "ArrowUp") {
      menuIndex = (menuIndex + 2) % 3;
      sound.play("hover");
    } else if (e.key === "Enter" || e.key === " ") {
      chooseMenu(menuIndex);
    }
    return;
  }

  if (screen === "credits") {
    screen = "menu";
    sound.play("click");
    return;
  }

  if (screen === "load") {
    if (e.key === "Escape") {
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
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") tutorialNext();
    else if (e.key === "ArrowLeft" || e.key === "Backspace") tutorialBack();
    else if (e.key === "Escape") {
      screen = "menu";
      sound.play("click");
    }
    return;
  }

  if (screen === "title") return;

  if (screen === "complete") {
    if (e.key === "Enter" || e.key === " ") {
      screen = "menu";
      sound.play("click");
      sound.startMenu();
    }
    return;
  }

  if (screen === "pause") {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      pauseIndex = pauseIndex === 0 ? 1 : 0;
      sound.play("hover");
    } else if (e.key === "Enter" || e.key === " ") {
      if (pauseIndex === 0) {
        screen = "play";
        sound.play("click");
      } else {
        screen = "menu";
        sound.play("click");
        sound.startMenu();
      }
    } else if (e.key === "Escape") {
      screen = "play";
      sound.play("click");
    }
    return;
  }

  if (screen === "play") {
    const dir = keyDir(e.key);
    if (dir) {
      e.preventDefault();
      move(dir);
      return;
    }
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      stage?.swapSplit();
      sound.play("click", { volume: 0.5 });
      return;
    }
    if (e.key === "r" || e.key === "R") {
      restartLevel();
      return;
    }
    if (e.key === "Escape") {
      pauseIndex = 0;
      screen = "pause";
      sound.play("click");
    }
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
  beginLevel(i, true);
}

function chooseMenu(i: number): void {
  sound.play("click");
  if (i === 0) {
    tutorialSlide = 0;
    tutorialOffset = 18;
    screen = "tutorial";
  } else if (i === 1) {
    loadCode = "";
    loadCursor = 0;
    loadInvalid = false;
    screen = "load";
  } else {
    screen = "credits";
  }
}

function tutorialNext(): void {
  sound.play("click");
  if (tutorialSlide < 8) {
    tutorialSlide++;
    tutorialOffset = 18;
  } else {
    startSession();
    beginLevel(0, true);
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
  if (!stage) return;
  sessionFails++;
  stage = new Stage(LEVELS[levelIndex]);
  renderer.cam = fitCamera(stage);
  enterPlay();
}

function unlock(): void {
  sound.unlock();
  screen = "menu";
  sound.startMenu();
}

canvas.addEventListener("pointerdown", (e) => {
  const p = pointerPos(e);
  if (screen === "boot") {
    unlock();
    return;
  }
  if (screen === "menu") {
    const hit = renderer.hitMenu(p.x, p.y, 236, 3);
    if (hit !== null) {
      menuIndex = hit;
      chooseMenu(iSafe(hit));
    }
    return;
  }
  if (screen === "credits") {
    screen = "menu";
    sound.play("click");
    return;
  }
  if (screen === "load") {
    if (p.y > 290 && p.y < 330) tryLoad();
    return;
  }
  if (screen === "tutorial") {
    const nav = renderer.hitTutorialNav(p.x, p.y);
    if (nav === "next") tutorialNext();
    if (nav === "back") tutorialBack();
    return;
  }
  if (screen === "complete") {
    screen = "menu";
    sound.play("click");
    sound.startMenu();
    return;
  }
  if (screen === "pause") {
    if (p.x > 100 && p.x < 280 && p.y > 140 && p.y < 172) {
      screen = "play";
      sound.play("click");
    } else if (p.x > 100 && p.x < 280 && p.y > 172 && p.y < 200) {
      screen = "menu";
      sound.play("click");
      sound.startMenu();
    }
    return;
  }
  if (screen === "play") {
    if (p.x > STAGE_W - 50 && p.y > STAGE_H - 28) {
      pauseIndex = 0;
      screen = "pause";
      sound.play("click");
    }
  }
});

canvas.addEventListener("pointermove", (e) => {
  const p = pointerPos(e);
  if (screen === "menu") menuHover = renderer.hitMenu(p.x, p.y, 236, 3);
  canvas.style.cursor = menuHover !== null || screen !== "play" ? "pointer" : "default";
});

window.addEventListener("keydown", onKey);

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

function iSafe(n: number): number {
  return n;
}

let last = now();
function frame(t: number): void {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function update(dt: number): void {
  logoTick += dt;
  if (logoTick > 0.12) {
    logoTick = 0;
    if (Math.random() < 0.18) logoFrame = Math.max(0, Math.min(5, logoFrame + (Math.random() < 0.5 ? -1 : 1)));
    else logoFrame = Math.min(5, logoFrame + (logoFrame < 5 ? 1 : 0));
    glitchX = Math.random() < 0.12 ? (Math.random() < 0.5 ? -2 : 2) : 0;
  }
  tutorialOffset += (0 - tutorialOffset) * Math.min(1, dt * 10);

  if ((screen === "play" || screen === "pause") && stage) {
    stage.tick(dt);
    if (busy && stage.anim && stage.anim.t >= stage.anim.dur) {
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
        stage = new Stage(LEVELS[levelIndex]);
        renderer.cam = fitCamera(stage);
        enterPlay();
      } else if (kind === "sink" && pendingResult === "win") {
        stage.anim = null;
        beginLevel(levelIndex + 1, true);
      }
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
    renderer.drawLogo(5, 162, 92);
    renderer.ctx.save();
    renderer.ctx.fillStyle = "#ffc37a";
    renderer.ctx.font = "16px Trebuchet MS, sans-serif";
    renderer.ctx.textAlign = "center";
    renderer.ctx.fillText("Click or press any key to start", STAGE_W / 2, 260);
    renderer.ctx.restore();
    return;
  }

  if (screen === "menu" || screen === "load" || screen === "credits") {
    renderer.drawBg("menu");
    renderer.drawLogo(logoFrame, 162, 88, glitchX);
    if (screen === "menu") renderer.drawMenuText(["Start New Game", "Load Stage", "Credits"], menuIndex, 236, menuHover);
    if (screen === "load") renderer.drawLoad(loadCode, Math.min(loadCursor, 5), loadInvalid);
    if (screen === "credits") renderer.drawCredits();
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
      renderer.drawPause(pauseIndex, formatTime(now() - sessionStart), levelIndex, stage.attempts);
    }
  }
}

async function boot(): Promise<void> {
  const assets = await loadAssets();
  renderer = new Renderer(canvas, assets);
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Bloxorz");
  await sound.load();
  requestAnimationFrame(frame);
}

void boot();
