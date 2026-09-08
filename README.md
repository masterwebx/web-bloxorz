# Bloxorz

A browser remake of Damien Clarke's 2007 puzzle game **Bloxorz**. All 33 original stages are included, with the same passcodes, switches, bridges, split blocks, and orange tiles.

This project reconstructs the Flash game using:

- Original tile, logo, tutorial, and UI graphics extracted from the SWF
- Stage layouts and switch logic from [Jacob Coughenour's GBA port](https://github.com/jacobcoughenour/bloxorz_gba)
- Canvas isometric rendering of the rolling 1×1×2 block

Bloxorz was created by Damien Clarke / DX Interactive (21 June 2007). This is an unofficial fan remake.

## How to play

- **Arrow keys** or **WASD** — roll the block (rebind in Settings)
- **Space** — switch which small cube you control after a split
- **Esc** — pause
- **R** — restart the current stage
- **M** — mute
- **Gamepad** — D-pad or left stick to roll, A to confirm, B to back, Start to pause, X to swap split cubes. Rumble can be toggled in Settings.

Passcodes sit in the top-right of each stage. Open **Load Stage** from the menu and type a six-digit code to jump there.

**Settings** (main menu) has music and SFX sliders, rumble on/off, and keyboard/gamepad remapping.

**Stage Creator** lets you paint a stage, then **Test** it. You have to beat your stage before it can be saved. Saved stages get a `BX1.` share code you can copy. **Play** loads your stages or a pasted code.

| Stage | Code |
| --- | --- |
| 01 | 780464 |
| 02 | 290299 |
| 03 | 918660 |
| 04 | 520967 |
| 05 | 028431 |
| 33 | 614955 |

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (port **4397**).

```bash
npm run build
npm run preview
```

## Deploy

This is a static Vite app. Vercel can host it with the included `vercel.json`. GitHub Pages also works: after the repo is on GitHub, the workflow in `.github/workflows/deploy-pages.yml` builds `main` and publishes it.

## Credits

- Original game: Damien Clarke, DX Interactive, 2007
- GBA port and reconstructed `levels.json`: Jacob Coughenour (MIT)
- Original Flash assets remain the property of their original authors
