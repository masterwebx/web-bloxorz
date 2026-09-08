#!/usr/bin/env python3
"""Convert GBA BMP assets to PNG for web use."""
import os
import shutil
from pathlib import Path
from PIL import Image

GBA_ROOT = Path("/tmp/bloxorz_gba/game")
OUT = Path("/workspace/public/assets")

SPRITE_BMPS = [
    "block.bmp", "bridge.bmp", "highlight.bmp", "bracket.bmp",
    "bg1.bmp", "level_gradient_bg.bmp", "text.bmp", "numbers.bmp",
    "pause_menu_bg.bmp", "nostabyte.bmp",
] + [f"tutorial_bg_{i}.bmp" for i in range(1, 10)] + [f"level_{i}.bmp" for i in range(1, 34)]


def bmp_to_png(name: str, src_dir: Path, dst_dir: Path):
    src = src_dir / name
    if not src.exists():
        print(f"skip missing: {name}")
        return
    img = Image.open(src)
    if img.mode == "P":
        img = img.convert("RGBA")
        datas = img.getdata()
        new_data = []
        for item in datas:
            if item[0] == 0 and item[1] == 0 and item[2] == 0:
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append(item)
        img.putdata(new_data)
    out = dst_dir / name.replace(".bmp", ".png")
    img.save(out)
    print(f"converted {name} -> {out.name}")


def main():
    sprites_dir = OUT / "sprites"
    audio_dir = OUT / "audio"
    data_dir = OUT / "data"
    sprites_dir.mkdir(parents=True, exist_ok=True)
    audio_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    for name in SPRITE_BMPS:
        bmp_to_png(name, GBA_ROOT / "graphics", sprites_dir)

    for wav in (GBA_ROOT / "audio").glob("*.wav"):
        shutil.copy2(wav, audio_dir / wav.name)

    shutil.copy2(GBA_ROOT / "levels.json", data_dir / "levels.json")
    print("Done.")


if __name__ == "__main__":
    main()
