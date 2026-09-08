import * as THREE from "three";
import { TILE, ORIENTATION } from "../game/constants.js";
import { tileCenter } from "../game/helpers.js";

export const LEVEL_OFFSET_X = 7.5;
export const LEVEL_OFFSET_Z = 5;

const COLORS = {
  stone: 0x8b7355,
  end: 0x253040,
  switchO: 0x5a8ab0,
  switchX: 0x905858,
  red: 0xc07028,
  split: 0x6858a0,
  bridge: 0x606870,
  bridgeOn: 0x889098,
  block: 0xc8b888,
  blockDark: 0xa89870,
};

export class BoardView {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.bridgeMeshes = new Map();
    this.geo = {
      tile: new THREE.BoxGeometry(0.94, 0.3, 0.94),
      hole: new THREE.BoxGeometry(0.82, 0.06, 0.82),
      bridge: new THREE.BoxGeometry(0.9, 0.14, 0.9),
    };
  }

  clear() {
    while (this.group.children.length) {
      const m = this.group.children[0];
      this.group.remove(m);
    }
    this.bridgeMeshes.clear();
  }

  build(level) {
    this.clear();
    this.group.position.set(-LEVEL_OFFSET_X, 0, -LEVEL_OFFSET_Z);

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 15; col++) {
        const idx = col + row * 15;
        const type = level.tiles[idx];
        if (type === TILE.EMPTY || type === TILE.BRIDGE_LEFT || type === TILE.BRIDGE_RIGHT) continue;

        const c = tileCenter(col, row);
        const mesh = this.makeTile(type);
        mesh.position.set(c.x, type === TILE.END ? 0.03 : 0.15, c.z);
        this.group.add(mesh);
      }
    }

    for (const b of level.bridges) {
      const col = b.index % 15;
      const row = Math.floor(b.index / 15);
      const c = tileCenter(col, row);
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.bridge,
        transparent: true,
        opacity: b.state ? 0.95 : 0.12,
        roughness: 0.7,
      });
      const mesh = new THREE.Mesh(this.geo.bridge, mat);
      mesh.position.set(c.x, 0.12, c.z);
      this.group.add(mesh);
      this.bridgeMeshes.set(b.index, mesh);
    }
  }

  makeTile(type) {
    let color = COLORS.stone;
    let geo = this.geo.tile;
    if (type === TILE.END) {
      color = COLORS.end;
      geo = this.geo.hole;
    } else if (type === TILE.SWITCH_O) color = COLORS.switchO;
    else if (type === TILE.SWITCH_X) color = COLORS.switchX;
    else if (type === TILE.RED) color = COLORS.red;
    else if (type === TILE.SPLIT) color = COLORS.split;

    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.06 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  syncBridges(bridges) {
    for (const b of bridges) {
      const mesh = this.bridgeMeshes.get(b.index);
      if (!mesh) continue;
      mesh.material.opacity = b.state ? 0.95 : 0.12;
      mesh.material.color.setHex(b.state ? COLORS.bridgeOn : COLORS.bridge);
      if (b.highlightTimer > 0) b.highlightTimer--;
    }
  }
}

export class BlockView {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.cubeGeo = new THREE.BoxGeometry(0.86, 0.86, 0.86);
    this.mat = new THREE.MeshStandardMaterial({ color: COLORS.block, roughness: 0.5, metalness: 0.1 });
    this.matDark = new THREE.MeshStandardMaterial({ color: COLORS.blockDark, roughness: 0.55, metalness: 0.08 });
    this.mesh = new THREE.Mesh(this.cubeGeo, this.mat);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
    this.mesh2 = null;
  }

  sync(state) {
    this.group.position.set(-LEVEL_OFFSET_X, 0, -LEVEL_OFFSET_Z);

    if (state.isSplit) {
      if (!this.mesh2) {
        this.mesh2 = new THREE.Mesh(this.cubeGeo, this.matDark);
        this.mesh2.castShadow = true;
        this.group.add(this.mesh2);
      }
      this.mesh.visible = true;
      this.mesh2.visible = true;
      this.mesh.scale.set(1, 1, 1);
      this.mesh2.scale.set(1, 1, 1);
      const c1 = tileCenter(state.pos.x, state.pos.y);
      const c2 = tileCenter(state.pos2.x, state.pos2.y);
      this.mesh.position.set(c1.x, 0.43, c1.z);
      this.mesh2.position.set(c2.x, 0.43, c2.z);
      this.mesh.material.emissive.setHex(state.activeSplit ? 0x000000 : 0x221100);
      this.mesh2.material.emissive.setHex(state.activeSplit ? 0x221100 : 0x000000);
      return;
    }

    if (this.mesh2) {
      this.group.remove(this.mesh2);
      this.mesh2 = null;
    }
    this.mesh.material.emissive.setHex(0x000000);
    this.mesh.visible = true;
    this.mesh.material.opacity = 1;

    const t = blockTransform(state.pos, state.orientation);
    this.mesh.scale.set(t.sx, t.sy, t.sz);
    this.mesh.position.set(t.px, t.py, t.pz);
  }

  async roll(prev, next, durationMs) {
    if (next.isSplit && !prev.isSplit) {
      this.sync(next);
      return;
    }
    if (prev.isSplit && next.isSplit) {
      this.sync(next);
      return;
    }

    const from = blockTransform(prev.pos, prev.orientation);
    const to = blockTransform(next.pos, next.orientation);

    await tween(durationMs, (e) => {
      this.mesh.scale.set(
        lerp(from.sx, to.sx, e),
        lerp(from.sy, to.sy, e),
        lerp(from.sz, to.sz, e)
      );
      this.mesh.position.set(
        lerp(from.px, to.px, e),
        lerp(from.py, to.py, e),
        lerp(from.pz, to.pz, e)
      );
    });
  }

  async fall() {
    const y0 = this.mesh.position.y;
    await tween(350, (t) => {
      this.mesh.position.y = y0 - t * 3;
      this.mesh.material.opacity = 1 - t * 0.5;
    });
    this.mesh.material.opacity = 1;
  }

  async sink() {
    const y0 = this.mesh.position.y;
    await tween(450, (t) => {
      this.mesh.position.y = y0 - t;
      this.mesh.material.opacity = 1 - t;
    });
  }
}

function blockTransform(pos, orientation) {
  const cx = pos.x + 0.5;
  const cz = pos.y + 0.5;

  if (orientation === ORIENTATION.UP) {
    return { sx: 1, sy: 2, sz: 1, px: cx, py: 1, pz: cz };
  }
  if (orientation === ORIENTATION.FORWARD) {
    return { sx: 1, sy: 1, sz: 2, px: cx, py: 0.5, pz: cz + 0.5 };
  }
  return { sx: 2, sy: 1, sz: 1, px: cx + 0.5, py: 0.5, pz: cz };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function tween(ms, fn) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      fn(t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export { tween };
