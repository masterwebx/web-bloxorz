export const STAGE_W = 550;
export const STAGE_H = 400;

export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${path.replace(/^\//, "")}`;
}

type Dir = "up" | "down" | "left" | "right";

export interface Assets {
  tiles: {
    stone: HTMLImageElement;
    end: HTMLImageElement;
    soft: HTMLImageElement;
    heavy: HTMLImageElement;
    fragile: HTMLImageElement;
    split: HTMLImageElement;
  };
  bridges: {
    l: HTMLImageElement[];
    r: HTMLImageElement[];
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
    rolls: Record<"up" | "forward" | "right" | "cube", Record<Dir, HTMLImageElement[]>>;
    sink: HTMLImageElement[];
  };
}

/** Original SWF character IDs: FORWARD, RIGHT, BACK, LEFT. */
export const ROLL_IDS: Record<"up" | "forward" | "right" | "cube", Record<Dir, number[]>> = {
  up: {
    up: [835, 837, 839, 841, 843, 845, 847, 849],
    right: [855, 857, 859, 861, 863, 865, 867, 869],
    down: [875, 877, 879, 881, 883, 885, 887, 889],
    left: [102, 104, 106, 108, 110, 112, 60, 62],
  },
  forward: {
    up: [915, 917, 919, 921, 923, 925, 927, 929],
    right: [935, 937, 939, 941, 943, 945, 947, 949],
    down: [955, 957, 959, 961, 963, 965, 967, 969],
    left: [895, 897, 899, 901, 903, 905, 907, 909],
  },
  right: {
    up: [66, 68, 70, 72, 74, 76, 78, 80],
    right: [979, 981, 983, 985, 987, 989, 991, 993],
    down: [1001, 1003, 1005, 1007, 1009, 1011, 1013, 1015],
    left: [84, 86, 88, 90, 92, 94, 96, 98],
  },
  cube: {
    up: [732, 734, 736, 738, 740, 742, 744, 746],
    right: [752, 754, 756, 758, 760, 762, 764, 766],
    down: [772, 774, 776, 778, 780, 782, 784, 786],
    left: [712, 714, 716, 718, 720, 722, 724, 726],
  },
};

export const SINK_IDS = [1134, 1137, 1139, 1141, 1143, 1145, 1147, 1149];

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
    ...[275, 277, 279, 281, 283, 286, 288, 290].map((id) =>
      loadImage(assetUrl(`assets/bridges/${id}.png`)),
    ),
    ...[300, 302, 304, 306, 308, 310, 312, 314].map((id) =>
      loadImage(assetUrl(`assets/bridges/${id}.png`)),
    ),
    ...(["up", "forward", "right", "cube"] as const).flatMap((ori) =>
      (["up", "right", "down", "left"] as const).flatMap((dir) =>
        ROLL_IDS[ori][dir].map((id) => loadImage(assetUrl(`assets/block/${id}.png`))),
      ),
    ),
    ...SINK_IDS.map((id) => loadImage(assetUrl(`assets/block/${id}.png`))),
  ]);

  const logo = rest.slice(0, 6);
  const tutorial = rest.slice(6, 15);
  const tutorialText = rest.slice(15, 24);
  const spin = [up, ...rest.slice(24, 32)];
  const bridgeL = rest.slice(32, 40);
  const bridgeR = rest.slice(40, 48);
  let i = 48;
  const pack = () => {
    const dirs = { up: rest.slice(i, i + 8), right: rest.slice(i + 8, i + 16), down: rest.slice(i + 16, i + 24), left: rest.slice(i + 24, i + 32) };
    i += 32;
    return dirs;
  };
  const rolls = { up: pack(), forward: pack(), right: pack(), cube: pack() };
  const sink = rest.slice(i, i + 8);

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
    block: { up, forward, right, cube, spin, rolls, sink },
    bridges: { l: bridgeL, r: bridgeR },
  };
}
