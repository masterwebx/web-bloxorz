# Bloxorz (Three.js)

A 3D Bloxorz clone built with **Three.js**, using the original 33-stage level data from the [GBA port](https://github.com/jacobcoughenour/bloxorz_gba).

Roll a rectangular block across floating platforms, hit switches to raise bridges, avoid fragile tiles, split on teleporters, and sink upright into the goal hole.

## Features

- All 33 levels with original passcodes (`levels.json`)
- Faithful game rules: orientations, switches, bridges, fragile tiles, split/join
- Smooth 3D roll / fall / sink animations
- Passcode level select from the menu

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Roll the block |
| Space | Switch between split cubes |
| Esc | Pause input |

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4317

## Stack

- [Vite](https://vitejs.dev/)
- [Three.js](https://threejs.org/)
- Level data from `public/assets/data/levels.json`

## Credits

- Original game: Damien Clarke, DX Interactive (2007)
- Level data: Jacob Coughenour's GBA port
