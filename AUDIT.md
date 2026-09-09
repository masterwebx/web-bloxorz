# AS2 vs HTML5 audit

Compared the original Flash 8 / ActionScript 2 SWF (`levelcodes`, tile movie clips, `softswitch` / `hardswitch` / `splitswitch` / `doorblockl` / `doorblockr`, `rejoinblocks`) with this Canvas port.

Unit tests live in `src/engine.test.ts`, `src/campaign.test.ts`, `src/generate.test.ts`, and `src/history.test.ts`. Run `npm test`.

The campaign suite replays the Free Web Arcade / JayIsGames solutions on all 33 stages (stage 03 uses a BFS-verified path because the published FAQ falls off this GBA reconstruction) and separately BFS-solves every stage so split / switch / orange mechanics cannot silently break.

| AS2 feature / mechanic | HTML5 port | Unit test |
| --- | --- | --- |
| 33 campaign stages | Yes | Yes — `LEVELS.length === 33` |
| 6-digit passcodes (`levelcodes`) | Yes, same codes in order | Yes — table match + `levelByCode` |
| 15×10 tile world | Yes | Indirect via `parseLevel` |
| 1×1×2 block, standing + two lying poses | Yes (`up` / `forward` / `right`) | Yes — `occupied` / `rolled` |
| Arrow-key rolls | Yes | Yes — roll sequence used in win/fail tests |
| Fall off empty tiles | Yes | Yes |
| Distinct fall clips (far/long/square) | One generic fall anim | No |
| Win only standing in `endblock` | Yes | Yes |
| Lying across the hole is not a win | Yes | Yes |
| Sink-into-hole / scatter tiles | Visual only | No |
| Stage title card | Billboard “STAGE NN” | No |
| Passcode + moves HUD | Yes | No |
| Load stage by passcode | Yes | Yes — lookup |
| Invalid passcode | Yes | `levelByCode` miss |
| Resume / start new / credits / mute | Yes | No |
| Pause (time, stage, attempts) | Yes | No |
| 9-page tutorial | Yes | No |
| “View instructions?” prompt | Yes | No |
| Soft / round switch (`softswitch`) | Yes — any occupied cell | Yes — lying block toggles |
| Heavy / X switch (`hardswitch`) | Yes — standing only | Yes |
| Bridges L/R (`doorblockl/r`) | Yes | Yes — `l/r` start off, `k/q` start on |
| Switch modes toggle / open / close | Yes (`onoff` / `on` / `off`) | Yes — `nextBridge` |
| Stay-off switch still keeps bridge | Yes | Indirect |
| Split teleport (`splitswitch`) | Yes | Yes — `beginSplit` + official walkthrough stages 08–10, 15, 16, 20, 23, 24, 26, 28 |
| Space toggles small cubes | Yes, HUD hint while split | Yes — `swapSplit` + walkthrough `S` |
| Rejoin when adjacent (`rejoinblocks`) | Yes | Yes |
| Split cube falls off | Yes | Yes |
| Official 33-stage walkthrough | Yes | Yes — `src/campaign.test.ts` |
| BFS reachability of every hole | Yes | Yes — `solveLevel` on all 33 |
| Seeded / daily generated puzzles | HTML5 extra | Yes — `generate.test.ts` |
| Orange / fragile tiles | Yes — fail if standing | Yes |
| Lie across orange | Yes | Yes |
| Tile assemble / scatter intro | Yes | No |
| Shadows | Lighting on 3D cuboid | No |
| Music / SFX | Yes | No |
| Menu + spinning block | Yes (3D cuboid) | No |
| Author / publisher splash | Author card only | No |
| Congratulations stats | Yes | No |
| Gamepad / rumble | HTML5 extra | No |
| Stage creator / packs / community | HTML5 extra | No |
| DEV name tools | HTML5 extra | Yes — `isDevName` |
