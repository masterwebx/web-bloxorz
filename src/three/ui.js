import { pad, formatTime } from "../game/helpers.js";

export class UI {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <div id="overlay">
        <div id="menu" class="panel">
          <h1>BLOXORZ</h1>
          <p class="sub">Three.js clone — 33 stages</p>
          <button data-action="play">Start New Game</button>
          <button data-action="load">Load Stage</button>
          <div id="load-panel" class="hidden">
            <label>Passcode</label>
            <input id="passcode" type="text" maxlength="6" placeholder="000000" />
            <button data-action="go">Go</button>
            <p id="load-err" class="err hidden">Invalid code</p>
          </div>
        </div>
        <div id="hud" class="hidden">
          <div class="hud-row"><span id="stage"></span><span id="code"></span></div>
          <div class="hud-row"><span id="moves"></span><span id="time"></span></div>
        </div>
        <div id="title" class="hidden"><span id="title-num"></span></div>
        <div id="complete" class="panel hidden">
          <h2>Congratulations!</h2>
          <p id="stats"></p>
          <button data-action="menu">Back to Menu</button>
        </div>
        <p id="hint">Arrow keys roll · Space switch cubes · Esc pause</p>
      </div>
    `;

    this.menu = root.querySelector("#menu");
    this.hud = root.querySelector("#hud");
    this.title = root.querySelector("#title");
    this.complete = root.querySelector("#complete");
    this.loadPanel = root.querySelector("#load-panel");
    this.loadErr = root.querySelector("#load-err");
    this.passcodeInput = root.querySelector("#passcode");

    root.querySelector('[data-action="play"]').onclick = () => this.onPlay?.();
    root.querySelector('[data-action="load"]').onclick = () => this.toggleLoad();
    root.querySelector('[data-action="go"]').onclick = () => this.onLoad?.(this.passcodeInput.value);
    root.querySelector('[data-action="menu"]').onclick = () => this.onMenu?.();
  }

  toggleLoad() {
    this.loadPanel.classList.toggle("hidden");
    this.loadErr.classList.add("hidden");
  }

  showMenu() {
    this.menu.classList.remove("hidden");
    this.hud.classList.add("hidden");
    this.title.classList.add("hidden");
    this.complete.classList.add("hidden");
  }

  showGame() {
    this.menu.classList.add("hidden");
    this.hud.classList.remove("hidden");
    this.complete.classList.add("hidden");
  }

  showTitle(num) {
    this.title.classList.remove("hidden");
    this.root.querySelector("#title-num").textContent = `STAGE ${pad(num, 2)}`;
  }

  hideTitle() {
    this.title.classList.add("hidden");
  }

  updateHud(state, elapsed) {
    this.root.querySelector("#stage").textContent = `Stage ${pad(state.levelIndex + 1, 2)}`;
    this.root.querySelector("#code").textContent = `Code ${pad(state.level.code, 6, "0")}`;
    this.root.querySelector("#moves").textContent = `Moves ${pad(state.moves, 4, " ")}`;
    this.root.querySelector("#time").textContent = formatTime(elapsed);
  }

  showComplete(moves, elapsed, fails) {
    this.hud.classList.add("hidden");
    this.complete.classList.remove("hidden");
    this.root.querySelector("#stats").textContent =
      `Moves: ${moves}  ·  Time: ${formatTime(elapsed)}  ·  Falls: ${fails}`;
  }

  flashLoadError() {
    this.loadErr.classList.remove("hidden");
  }
}
