const SPRITE_FILES = [
  "block", "bridge", "highlight", "bracket",
  "bg1", "level_gradient_bg", "text", "numbers",
  "pause_menu_bg", "nostabyte", "font",
  ...Array.from({ length: 9 }, (_, i) => `tutorial_bg_${i + 1}`),
  ...Array.from({ length: 33 }, (_, i) => `level_${i + 1}`),
];

const AUDIO_FILES = [
  "ambient", "menu", "title_card", "click", "hover", "fail",
  "drop_in", "whoosh", "whoosh_2", "bridge_enabled", "bridge_disabled",
  "splash",
  ...Array.from({ length: 6 }, (_, i) => `move_${i + 1}`),
  ...Array.from({ length: 6 }, (_, i) => `move_hollow_${i + 1}`),
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function loadAudio(src) {
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
}

export async function loadAssets(onProgress) {
  const sprites = {};
  const audio = {};
  const total = SPRITE_FILES.length + AUDIO_FILES.length;
  let loaded = 0;

  const tick = () => {
    loaded++;
    onProgress?.(loaded / total);
  };

  await Promise.all([
    ...SPRITE_FILES.map(async (name) => {
      sprites[name] = await loadImage(`/assets/sprites/${name}.png`);
      tick();
    }),
    ...AUDIO_FILES.map(async (name) => {
      audio[name] = loadAudio(`/assets/audio/${name}.wav`);
      tick();
    }),
  ]);

  return { sprites, audio };
}

export function drawSpriteFrame(ctx, sheet, frame, x, y, flipX = false) {
  const fw = 32;
  const fh = 32;
  ctx.save();
  if (flipX) {
    ctx.translate(x + fw, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, 0, frame * fh, fw, fh, 0, 0, fw, fh);
  } else {
    ctx.drawImage(sheet, 0, frame * fh, fw, fh, x, y, fw, fh);
  }
  ctx.restore();
}

/** Draw a 256x256 background centered at (cx, cy) in GBA coords. */
export function drawBgCentered(ctx, img, cx, cy, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - 128, cy - 128);
  ctx.restore();
}

export function drawDigit(ctx, sheet, digit, x, y) {
  drawSpriteFrame(ctx, sheet, digit, x, y);
}
