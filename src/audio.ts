export class SoundBank {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private ambient: AudioBufferSourceNode | null = null;
  muted = false;
  unlocked = false;

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
        const res = await fetch(`/assets/audio/${name}.wav`);
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

  play(name: string, { volume = 1, loop = false } = {}): AudioBufferSourceNode | null {
    if (this.muted || !this.unlocked) return null;
    const buffer = this.buffers.get(name);
    if (!buffer) return null;
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    src.loop = loop;
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ctx.destination);
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
    const src = this.play("ambient", { volume: 0.55, loop: true });
    this.ambient = src;
  }

  startMenu(): void {
    this.stopAmbient();
    if (this.muted || !this.unlocked) return;
    const src = this.play("menu", { volume: 0.7, loop: true });
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
    return this.muted;
  }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }
}
