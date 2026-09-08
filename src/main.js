import { loadLevels } from "./game/levelParser.js";
import { BloxorzApp } from "./three/app.js";

async function main() {
  const canvas = document.getElementById("canvas");
  const overlay = document.getElementById("overlay");

  const levels = await loadLevels();
  new BloxorzApp(canvas, overlay, levels);
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#fff;padding:2rem">${err.message}</pre>`;
});
