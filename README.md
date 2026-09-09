# Player-named Bloxorz remake

A browser remake of Damien Clarke's 2007 puzzle game **Bloxorz**. All 33 original stages are included, with the same passcodes, switches, bridges, split blocks, and orange tiles.

On first launch you enter a name. The title becomes that name plus **ORZ** — Wex is **WEXORZ**, David is **DAVIDORZ**. Change it later in Settings.

Set the name to **DEV** (any case) to unlock developer tools: **Load Stage** becomes a 33-stage list, in-game **Dev Menu** jumps between stages or force-wins, and **Beat stage for me** (under Menu, in every play mode including editor playtest) restarts at spawn and rolls the BFS solution. A short jingle plays when you first set the name to DEV so you know it unlocked. Mechanics coverage vs the original Flash game is in `AUDIT.md`. `npm test` plays the [official 33-stage walkthrough](https://www.freewebarcade.com/help/bloxorz-walkthrough.php) and BFS-solves every campaign stage so splits, switches, bridges, and orange tiles stay honest.

Each death counts as an attempt (shown on the pause screen). Finishing the campaign freezes the time on the congratulations screen; **Show Stats** lists how long each stage took. **History** on the main menu stores previous campaign runs so you can replay a stage’s winning route. Turn on **See ghosts** to overlay your other tries on that replay, Super Meat Boy style.

**Puzzles** generates new stages from a seed (BFS-verified, same idea as the [Bloxorz search-agent paper](https://www.sciencedirect.com/science/article/pii/S187705091932160X)). **Daily** is today’s UTC date plus a difficulty. **Seeded Run** takes any seed and 1, 5, or 10 stages at Easy / Medium / Hard / Insane.

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

**Settings** has your player name, music and SFX sliders, rumble on/off, and keyboard/gamepad remapping.

## Puzzles

**Puzzles** on the main menu has **Daily** and **Seeded Run**.

- **Daily** — one new stage per UTC day at Easy, Medium, Hard, or Insane. Everyone with the same date and difficulty gets the same map.
- **Seeded Run** — type a seed, pick a difficulty, and play 1, 5, or 10 generated stages. The same seed always rebuilds the same run.

Maps are grown as connected tiles, then a BFS solver (the same search used in the 2019 Bloxorz pathfinding paper) keeps only stages that actually reach the hole. Harder difficulties add orange tiles, switches/bridges, and split pads.

## Stage Creator

From the main menu, **Stage Creator** splits into **Create** and **Play**.

### Create

- **New Stage** — paint a 15×10 grid. A new stage starts with a stone path, a spawn, and an exit already connected.
- **Manage** — edit or delete local and downloaded stages, or build a **stage pack** (an ordered list of stages). Enter opens a stage in the editor or plays a pack. Delete / Backspace removes a stage or pack.

Keyboard and controller both work in the editor: arrows / stick move the cursor, Confirm / A paints, `[` `]` or LB/RB (or X) cycle tools, Enter / Start tests the stage. Playtest is always allowed even if the solver says the map is impossible.

A live badge shows **CAN BE BEAT** (green) or **IMPOSSIBLE** (red) using the same BFS used for puzzles. It does not block Test.

**Split** is a three-click tool: paint the pad, then click cube A’s landing tile, then cube B’s. Those landings stay ordinary tiles (not extra split pads). Click a left/right bridge a second time to start it ON (`k` / `q`).

You have to beat a stage before it can be saved. Every layout gets a short id (`BXS-XXXXXXXX`) and a reconstructable **BXS.** seed (packed tiles, spawn, switches, splits). Saved stages also still get a `BX1.` share code. Enter Code accepts BX1, BXS. seeds, or a short BXS- id if that stage is already on the machine / community list. They store your player name as the author.

### Play

- **Enter Code** — paste a `BX1.` share code, a `BXS.` seed, or a short `BXS-` id already saved/downloaded
- **Offline** — stages saved on this machine
- **Online** — stages listed in the community JSON (see below)

Custom stages show their **name** and **author** on the title card, the same way classic play shows `STAGE 01`.

## Community stages (Online)

Online play reads `public/community/stages.json`. The game tries GitHub first:

`https://raw.githubusercontent.com/masterwebx/web-bloxorz/main/public/community/stages.json`

then falls back to the copy bundled with the app.

Add a stage by appending an object to `stages` with `name`, `author`, and either:

- `"code": "BX1...."` from the editor, or
- `"tiles"` (10 strings of 15 characters) plus `"spawn": [x, y]`, with optional `switches` and `splits`

Characters: `b` stone, `e` exit, `s` soft switch, `h` heavy switch, `f` fragile, `v` split, `l`/`r` bridges.

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
