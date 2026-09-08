export const STAGE_W = 550;
export const STAGE_H = 400;

export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${path.replace(/^\//, "")}`;
}

export interface Assets {
  tiles: {
    stone: HTMLImageElement;
    end: HTMLImageElement;
    soft: HTMLImageElement;
    heavy: HTMLImageElement;
    fragile: HTMLImageElement;
    split: HTMLImageElement;
  };
  ui: {
    menuBg: HTMLImageElement;
    levelBg: HTMLImageElement;
    logo: HTMLImageElement[];
    stage: HTMLImageElement;
    numbers: HTMLImageElement;
    congrats: HTMLImageElement;
    highlight: HTMLImageElement;
    bracket: HTMLImageElement;
    startNew: HTMLImageElement;
    loadStage: HTMLImageElement;
    toggleSound: HTMLImageElement;
    credits: HTMLImageElement;
    typePasscode: HTMLImageElement;
    hudDigits: HTMLImageElement;
    loadDigits: HTMLImageElement;
    enter: HTMLImageElement;
    next: HTMLImageElement;
    backMenu: HTMLImageElement;
    skip: HTMLImageElement;
    prev: HTMLImageElement;
    start: HTMLImageElement;
    returnGame: HTMLImageElement;
    quitMenu: HTMLImageElement;
    pauseStats: HTMLImageElement;
  };
  splash: {
    presented: HTMLImageElement;
    addicting: HTMLImageElement;
    tagline: HTMLImageElement;
    author: HTMLImageElement;
  };
  tutorial: HTMLImageElement[];
  tutorialText: HTMLImageElement[];
  block: {
    up: HTMLImageElement;
    forward: HTMLImageElement;
    right: HTMLImageElement;
    cube: HTMLImageElement;
    spin: HTMLImageElement[];
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function loadAssets(): Promise<Assets> {
  const [
    stone,
    end,
    soft,
    heavy,
    fragile,
    split,
    menuBg,
    levelBg,
    stage,
    numbers,
    congrats,
    highlight,
    bracket,
    up,
    forward,
    right,
    cube,
    startNew,
    loadStage,
    toggleSound,
    credits,
    typePasscode,
    hudDigits,
    loadDigits,
    enter,
    next,
    backMenu,
    skip,
    prev,
    start,
    returnGame,
    quitMenu,
    pauseStats,
    presented,
    addicting,
    tagline,
    author,
    ...rest
  ] = await Promise.all([
    loadImage(assetUrl("assets/tiles/267.png")),
    loadImage(assetUrl("assets/tiles/298.png")),
    loadImage(assetUrl("assets/tiles/293.png")),
    loadImage(assetUrl("assets/tiles/295.png")),
    loadImage(assetUrl("assets/tiles/318.png")),
    loadImage(assetUrl("assets/tiles/316.png")),
    loadImage(assetUrl("assets/ui/45.png")),
    loadImage(assetUrl("assets/ui/336.png")),
    loadImage(assetUrl("assets/ui/325.png")),
    loadImage(assetUrl("assets/ui/329.png")),
    loadImage(assetUrl("assets/ui/186.png")),
    loadImage(assetUrl("assets/ui/268.png")),
    loadImage(assetUrl("assets/ui/708.png")),
    loadImage(assetUrl("assets/block/833.png")),
    loadImage(assetUrl("assets/block/851.png")),
    loadImage(assetUrl("assets/block/871.png")),
    loadImage(assetUrl("assets/block/706.png")),
    loadImage(assetUrl("assets/ui/133.png")),
    loadImage(assetUrl("assets/ui/137.png")),
    loadImage(assetUrl("assets/ui/142.png")),
    loadImage(assetUrl("assets/ui/146.png")),
    loadImage(assetUrl("assets/ui/155.png")),
    loadImage(assetUrl("assets/ui/347.png")),
    loadImage(assetUrl("assets/ui/158.png")),
    loadImage(assetUrl("assets/ui/165.png")),
    loadImage(assetUrl("assets/ui/193.png")),
    loadImage(assetUrl("assets/ui/204.png")),
    loadImage(assetUrl("assets/ui/208.png")),
    loadImage(assetUrl("assets/ui/221.png")),
    loadImage(assetUrl("assets/ui/261.png")),
    loadImage(assetUrl("assets/ui/1167.png")),
    loadImage(assetUrl("assets/ui/1171.png")),
    loadImage(assetUrl("assets/ui/1177.png")),
    loadImage(assetUrl("assets/splash/16.png")),
    loadImage(assetUrl("assets/splash/31.png")),
    loadImage(assetUrl("assets/splash/32.png")),
    loadImage(assetUrl("assets/splash/182.png")),
    ...[43, 48, 50, 52, 54, 56].map((id) => loadImage(assetUrl(`assets/ui/${id}.png`))),
    ...[199, 216, 226, 231, 236, 241, 246, 251, 256].map((id) =>
      loadImage(assetUrl(`assets/tutorial/${id}.png`)),
    ),
    ...[202, 219, 229, 234, 239, 244, 249, 254, 259].map((id) =>
      loadImage(assetUrl(`assets/tutorial/${id}.png`)),
    ),
    ...[116, 118, 120, 122, 124, 126, 128, 130].map((id) =>
      loadImage(assetUrl(`assets/block/${id}.png`)),
    ),
  ]);

  const logo = rest.slice(0, 6);
  const tutorial = rest.slice(6, 15);
  const tutorialText = rest.slice(15, 24);
  const spin = [up, ...rest.slice(24, 32)];

  return {
    tiles: { stone, end, soft, heavy, fragile, split },
    ui: {
      menuBg,
      levelBg,
      logo,
      stage,
      numbers,
      congrats,
      highlight,
      bracket,
      startNew,
      loadStage,
      toggleSound,
      credits,
      typePasscode,
      hudDigits,
      loadDigits,
      enter,
      next,
      backMenu,
      skip,
      prev,
      start,
      returnGame,
      quitMenu,
      pauseStats,
    },
    splash: { presented, addicting, tagline, author },
    tutorial,
    tutorialText,
    block: { up, forward, right, cube, spin },
  };
}
