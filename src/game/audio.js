export class AudioManager {
  constructor(buffers) {
    this.buffers = buffers;
    this.currentMusic = null;
    this.volume = 0.7;
  }

  play(name, { loop = false, volume = 1 } = {}) {
    const src = this.buffers[name];
    if (!src) return null;
    const audio = src.cloneNode();
    audio.volume = volume * this.volume;
    audio.loop = loop;
    audio.play().catch(() => {});
    return audio;
  }

  playMusic(name, volume = 0.7) {
    this.stopMusic();
    this.currentMusic = this.play(name, { loop: true, volume });
    return this.currentMusic;
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
    }
  }

  playMove(hollow = false) {
    const idx = Math.floor(Math.random() * 6) + 1;
    const name = hollow ? `move_hollow_${idx}` : `move_${idx}`;
    this.play(name);
  }
}
