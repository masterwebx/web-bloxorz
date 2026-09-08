import { loadAssets } from "./game/assets.js";
import { loadLevels } from "./game/levelParser.js";
import { Game } from "./game/game.js";

async function main() {
  const canvas = document.getElementById("game");
  const loadingEl = document.getElementById("controls-hint");

  const [assets, levels] = await Promise.all([
    loadAssets((p) => {
      loadingEl.textContent = `Loading... ${Math.round(p * 100)}%`;
    }),
    loadLevels(),
  ]);

  loadingEl.textContent = "Arrow keys to roll · Space to switch blocks · Esc to pause";

  const game = new Game(canvas, assets.sprites, assets.audio);
  await game.init(levels);

  window.addEventListener("keydown", (e) => game.handleKeyDown(e));
  window.addEventListener("keyup", (e) => game.handleKeyUp(e));

  function loop() {
    game.tick();
    requestAnimationFrame(loop);
  }
  loop();
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:white;padding:2rem">Failed to load: ${err.message}</pre>`;
});
