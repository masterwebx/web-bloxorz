import * as THREE from "three";

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x120f1a);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x120f1a, 18, 42);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(10, 12, 10);
  camera.lookAt(0, 0.5, 0);

  const ambient = new THREE.AmbientLight(0x9080a0, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff0dd, 1.1);
  sun.position.set(8, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x6688cc, 0.35);
  fill.position.set(-6, 8, -4);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0a0810, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener("resize", resize);

  return { renderer, scene, camera, resize };
}
