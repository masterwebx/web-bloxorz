import { assetUrl } from "./assets";

export class SoundBank {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private ambient: AudioBufferSourceNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  muted = false;
  unlocked = false;
  sfx = 0.9;
  music = 0.7;

  async load(): Promise<void> {
    const names = [
      "ambient",
      "menu",
      "click",
      "hover",
      "fail",
      "drop_in",
      "whoosh",
      "whoosh_2",
      "title_card",
      "bridge_enabled",
      "bridge_disabled",
      "splash",
      ...[1, 2, 3, 4, 5, 6].map((n) => `move_${n}`),
      ...[1, 2, 3, 4, 5, 6].map((n) => `move_hollow_${n}`),
    ];
    const ctx = this.getCtx();
    await Promise.all(
      names.map(async (name) => {
        const res = await fetch(assetUrl(`assets/audio/${name}.wav`));
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

  move(hollow: boolean): void {
    const n = 1 + Math.floor(Math.random() * 6);
    this.play(hollow ? `move_hollow_${n}` : `move_${n}`, { volume: 0.9 });
  }

  startAmbient(): void {
    this.stopAmbient();
    if (this.muted || !this.unlocked) return;
    const src = this.play("ambient", { volume: 0.55, loop: true, music: true });
    this.ambient = src;
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
