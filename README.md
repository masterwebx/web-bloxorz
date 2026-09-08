# Bloxorz

A faithful HTML/JavaScript remake of the classic puzzle game **Bloxorz**, ported from the [GBA clone](https://github.com/jacobcoughenour/bloxorz_gba) which itself recreates Damien Clarke's original Flash game (DX Interactive, 2007).

Roll a rectangular block across isometric platforms, hit switches to raise bridges, avoid fragile tiles, split into two cubes on teleporters, and sink the block upright into the goal hole across all 33 stages.

## Features

- All 33 original stages with authentic level data and passcodes
- Isometric rendering using original Flash-derived sprite art
- Block rolling physics, bridge switches, fragile tiles, split/join mechanics
- Main menu, 9-page tutorial, passcode level select, pause menu
- Move counter, timer, and completion stats
- Original sound effects and music

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Roll the block |
| Space | Switch between split cubes / confirm menu |
| Escape | Pause game / back |

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4317

## Build

```bash
npm run build
npm run preview
```

## Credits

- Original game: Damien Clarke, DX Interactive (2007)
- GBA port & level data: Jacob Coughenour, Nostabyte Interactive
- This HTML remake uses assets and logic from the GBA port repository

## License

Game assets and level data follow the upstream GBA port licensing. See the [bloxorz_gba repository](https://github.com/jacobcoughenour/bloxorz_gba) for details.
