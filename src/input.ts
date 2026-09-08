import { ACTIONS, type Action, type Settings } from "./settings";

export class Input {
  settings: Settings;
  listening: Action | null = null;
  listenKind: "key" | "pad" | null = null;
  justBound = false;
  private keysDown = new Set<string>();
  private prevPad = new Set<number>();
  private padHeld = new Set<number>();
  private padDown = new Set<number>();
  private moveCool = 0;
  connected = false;

  constructor(settings: Settings) {
    this.settings = settings;
    window.addEventListener("keydown", (e) => {
      this.keysDown.add(e.key);
      if (this.listening && this.listenKind === "key") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.settings.keys[this.listening] = e.key;
        this.listening = null;
        this.listenKind = null;
        this.justBound = true;
      }
    });
    window.addEventListener("keyup", (e) => this.keysDown.delete(e.key));
  }

  rumble(duration: number, strong = 0.5, weak = 0.35): void {
    if (!this.settings.rumble) return;
    for (const g of navigator.getGamepads()) {
      if (!g) continue;
      const actuator = (g as Gamepad & { vibrationActuator?: GamepadHapticActuator }).vibrationActuator;
      if (!actuator?.playEffect) continue;
      void actuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration,
        strongMagnitude: strong,
        weakMagnitude: weak,
      });
    }
  }

  update(dt: number): void {
    this.moveCool = Math.max(0, this.moveCool - dt);
    const pads = navigator.getGamepads();
    this.connected = false;
    this.padHeld.clear();
    this.padDown.clear();
    const pressed = new Set<number>();
    for (const g of pads) {
      if (!g) continue;
      this.connected = true;
      g.buttons.forEach((b, i) => {
        if (b.pressed) pressed.add(i);
      });
      const ax = g.axes[0] ?? 0;
      const ay = g.axes[1] ?? 0;
      if (ay < -0.55) pressed.add(12);
      if (ay > 0.55) pressed.add(13);
      if (ax < -0.55) pressed.add(14);
      if (ax > 0.55) pressed.add(15);
    }
    for (const i of pressed) {
      this.padHeld.add(i);
      if (!this.prevPad.has(i)) this.padDown.add(i);
    }
    if (this.listening && this.listenKind === "pad") {
      for (const i of this.padDown) {
        this.settings.pads[this.listening] = i;
        this.listening = null;
        this.listenKind = null;
        this.justBound = true;
        break;
      }
    }
    this.prevPad = pressed;
  }

  pressed(action: Action): boolean {
    const key = this.settings.keys[action];
    if (this.keysDown.has(key)) return true;
    if (key === "Space" && this.keysDown.has(" ")) return true;
    return this.padHeld.has(this.settings.pads[action]);
  }

  justPad(action: Action): boolean {
    return this.padDown.has(this.settings.pads[action]);
  }

  consumeMove(): "up" | "down" | "left" | "right" | null {
    if (this.moveCool > 0) return null;
    const dirs: ("up" | "down" | "left" | "right")[] = ["up", "down", "left", "right"];
    for (const d of dirs) {
      if (this.padHeld.has(this.settings.pads[d])) {
        this.moveCool = 0.16;
        return d;
      }
    }
    return null;
  }

  keyName(action: Action): string {
    const k = this.settings.keys[action];
    if (k === " ") return "Space";
    if (k.startsWith("Arrow")) return `${k.replace("Arrow", "")} Arrow`;
    return k.length === 1 ? k.toUpperCase() : k;
  }

  padName(action: Action): string {
    const n = this.settings.pads[action];
    const names = [
      "A",
      "B",
      "X",
      "Y",
      "LB",
      "RB",
      "LT",
      "RT",
      "Select",
      "Start",
      "L3",
      "R3",
      "D-Up",
      "D-Down",
      "D-Left",
      "D-Right",
    ];
    return names[n] ?? `Btn ${n}`;
  }

  bindList(): Action[] {
    return ACTIONS;
  }
}
