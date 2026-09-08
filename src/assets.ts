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
  };
  tutorial: HTMLImageElement[];
  block: {
    up: HTMLImageElement;
    forward: HTMLImageElement;
    right: HTMLImageElement;
    cube: HTMLImageElement;
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
    ...[43, 48, 50, 52, 54, 56].map((id) => loadImage(assetUrl(`assets/ui/${id}.png`))),
    ...[199, 216, 226, 231, 236, 241, 246, 251, 256].map((id) =>
      loadImage(assetUrl(`assets/tutorial/${id}.png`)),
    ),
  ]);

  const logo = rest.slice(0, 6);
  const tutorial = rest.slice(6);

  return {
    tiles: { stone, end, soft, heavy, fragile, split },
    ui: { menuBg, levelBg, logo, stage, numbers, congrats, highlight, bracket },
    tutorial,
    block: { up, forward, right, cube },
  };
}
