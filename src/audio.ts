import { assetUrl } from "./assets";
import type { Tile } from "./engine";

type ClonkKind = "clonk" | "half" | "metal" | "halfmetal" | "hollow";

const FILES: Record<string, string> = {
  menu: "Music.mp3",
  click: "Click.mp3",
  hover: "Latch.mp3",
  fail: "mech5wav.mp3",
  drop_in: "blox032wav.mp3",
  whoosh: "blox033wav.mp3",
  whoosh_2: "blox034wav.mp3",
  unsplit: "unsplitwav.mp3",
  join_far: "blox035wav.mp3",
  join_long: "blox036wav.mp3",
  win: "blox003wav.mp3",
  title_card: "blox2wav.mp3",
  bridge_enabled: "blox027wav.mp3",
  bridge_disabled: "blox028wav.mp3",
  bridge_r_enabled: "blox029wav.mp3",
  bridge_r_disabled: "blox030wav.mp3",
  fragile_break: "blox031wav.mp3",
  smallswitch: "blox025wav.mp3",
  bigswitch: "blox026wav.mp3",
  splash: "splash.wav",
  clonk0: "blox004wav.mp3",
  clonk1: "blox005wav.mp3",
  clonk2: "blox006wav.mp3",
  clonk3: "blox007wav.mp3",
  clonk4: "blox008wav.mp3",
  clonk5: "blox009wav.mp3",
  half0: "blox010wav.mp3",
  half1: "blox011wav.mp3",
  half2: "blox012wav.mp3",
  half3: "blox013wav.mp3",
  half4: "blox014wav.mp3",
  half5: "blox015wav.mp3",
  metal0: "blox016wav.mp3",
  metal1: "blox017wav.mp3",
  metal2: "blox018wav.mp3",
  halfmetal0: "blox019wav.mp3",
  halfmetal1: "blox020wav.mp3",
  halfmetal2: "blox021wav.mp3",
  hollow0: "blox022wav.mp3",
  hollow1: "blox023wav.mp3",
  hollow2: "blox024wav.mp3",
};

const CLONK_COUNT: Record<ClonkKind, number> = {
  clonk: 6,
  half: 6,
  metal: 3,
  halfmetal: 3,
  hollow: 3,
};

export class SoundBank {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private ambient: AudioBufferSourceNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private lastVar = new Map<string, number>();
  muted = false;
  unlocked = false;
  sfx = 0.9;
  music = 0.7;

  async load(): Promise<void> {
    const ctx = this.getCtx();
    await Promise.all(
      Object.entries(FILES).map(async ([name, file]) => {
        const res = await fetch(assetUrl(`assets/audio/${file}`));
        const buf = await res.arrayBuffer();
        this.buffers.set(name, await ctx.decodeAudioData(buf.slice(0)));
      }),
    );
  }

  unlock(): void {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") void ctx.resume();
    this.unlocked = true;
  }

  setMix(sfx: number, music: number): void {
    this.sfx = sfx;
    this.music = music;
    this.applyGains();
  }

  play(name: string, { volume = 1, loop = false, music = false } = {}): AudioBufferSourceNode | null {
    if (this.muted || !this.unlocked) return null;
    const buffer = this.buffers.get(name);
    if (!buffer) return null;
    const ctx = this.getCtx();
    this.ensureGains();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    src.loop = loop;
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(music ? this.musicGain! : this.sfxGain!);
    src.start();
    return src;
  }

  clonk(kind: ClonkKind): void {
    const n = CLONK_COUNT[kind];
    let next = Math.floor(Math.random() * n);
    const prev = this.lastVar.get(kind);
    if (n > 1 && next === prev) next = (next + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.lastVar.set(kind, next);
    this.play(`${kind}${next}`, { volume: 0.95 });
  }

  /** Match original per-tile land sounds (stone clonk, metal bridge, hollow orange, switches). */
  landTile(tile: Tile, upright: boolean, cube: boolean): void {
    if (tile === "empty") return;
    if (tile === "heavy" && upright && !cube) {
      this.play("bigswitch");
      return;
    }
    if (tile === "soft" || tile === "split") {
      this.play("smallswitch");
      return;
    }
    if (tile === "fragile") {
      this.clonk("hollow");
      return;
    }
    if (tile === "bridgeL" || tile === "bridgeR") {
      this.clonk(cube ? "halfmetal" : "metal");
      return;
    }
    this.clonk(cube ? "half" : "clonk");
  }

  startAmbient(): void {
    this.stopAmbient();
  }

  startMenu(): void {
    this.stopAmbient();
    if (this.muted || !this.unlocked) return;
    const src = this.play("menu", { volume: 0.7, loop: true, music: true });
    this.ambient = src;
  }

  stopAmbient(): void {
    try {
      this.ambient?.stop();
    } catch {
      /* already stopped */
    }
    this.ambient = null;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) this.stopAmbient();
    this.applyGains();
    return this.muted;
  }

  /** Short jingle when the player name becomes DEV and the hidden menu unlocks. */
  playDevUnlock(): void {
    this.play("title_card", { volume: 0.8 });
    this.play("whoosh_2", { volume: 0.85 });
    if (this.muted || !this.unlocked) return;
    const ctx = this.getCtx();
    this.ensureGains();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    });
  }

  private ensureGains(): void {
    const ctx = this.getCtx();
    if (!this.sfxGain) {
      this.sfxGain = ctx.createGain();
      this.sfxGain.connect(ctx.destination);
      this.musicGain = ctx.createGain();
      this.musicGain.connect(ctx.destination);
    }
    this.applyGains();
  }

  private applyGains(): void {
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : this.sfx;
    if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : this.music;
  }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }
}
