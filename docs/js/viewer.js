import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BomPanel } from './bom-panel.js';
import { AnimationController } from './animations.js';

const PARTS_URL = './data/parts.json';
const CONFIG_URL = './data/viewer-config.json';

/** @type {Map<string, object>} */
let partsByNode = new Map();
/** @type {Array<{ clipName: string, label: string }>} */
let animationDefs = [];
/** @type {object | null} */
let viewerConfig = null;
/** @type {THREE.Object3D | null} */
let modelRoot = null;
/** @type {THREE.MeshStandardMaterial[]} */
const highlightRestore = [];
/** @type {THREE.Object3D | null} */
let highlightedObject = null;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('viewer-canvas'));
const loadingEl = document.getElementById('loading');
const errorBanner = document.getElementById('error-banner');

const bomPanel = new BomPanel({
  sheet: document.getElementById('bom-sheet'),
  backdrop: document.getElementById('bom-backdrop'),
  closeBtn: document.getElementById('bom-close'),
  category: document.getElementById('bom-category'),
  title: document.getElementById('bom-title'),
  id: document.getElementById('bom-id'),
  description: document.getElementById('bom-description'),
  quantity: document.getElementById('bom-quantity'),
});

const animController = new AnimationController(
  null,
  [],
  document.getElementById('anim-buttons'),
  document.getElementById('anim-pause'),
  document.getElementById('anim-reset'),
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(2.5, 2, 3.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 12;
controls.target.set(0, 0.6, 0);
controls.enablePan = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = { x: 0, y: 0, time: 0 };

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url}`);
  return res.json();
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideLoading() {
  loadingEl.classList.add('hidden');
}

function indexParts(partsData) {
  partsByNode = new Map();
  for (const part of partsData.parts || []) {
    partsByNode.set(part.nodeName, part);
  }
  animationDefs = partsData.animations || [];
}

function applyConfig(config) {
  viewerConfig = config;
  scene.background = new THREE.Color(config.backgroundColor || '#0f1419');
  if (config.camera) {
    camera.fov = config.camera.fov ?? 45;
    controls.minDistance = config.camera.minDistance ?? 0.8;
    controls.maxDistance = config.camera.maxDistance ?? 12;
    if (config.camera.target) {
      controls.target.fromArray(config.camera.target);
    }
  }
  if (config.lights) {
    scene.children
      .filter((c) => c.userData.isViewerLight)
      .forEach((c) => scene.remove(c));
    const amb = new THREE.AmbientLight(0xffffff, config.lights.ambientIntensity ?? 0.55);
    amb.userData.isViewerLight = true;
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, config.lights.directionalIntensity ?? 1.1);
    dir.position.fromArray(config.lights.directionalPosition || [4, 8, 6]);
    dir.userData.isViewerLight = true;
    scene.add(dir);
  }
}

function fitCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.8;
  camera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.8);
  controls.target.copy(center);
  controls.minDistance = maxDim * 0.3;
  controls.maxDistance = maxDim * 6;
  controls.update();
}

function buildFallbackDemo() {
  const root = new THREE.Group();
  root.name = 'RainMachine';

  const matBase = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.3, roughness: 0.7 });
  const matPump = new THREE.MeshStandardMaterial({ color: 0x2b6cb0, metalness: 0.5, roughness: 0.4 });
  const matNozzle = new THREE.MeshStandardMaterial({ color: 0x38a169, metalness: 0.6, roughness: 0.35 });
  const matPanel = new THREE.MeshStandardMaterial({ color: 0x805ad5, metalness: 0.2, roughness: 0.6 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 1.2), matBase);
  base.name = 'BasePlate';
  base.position.y = 0.075;
  root.add(base);

  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 16), matPump);
  pump.name = 'PumpBody';
  pump.position.set(0, 0.4, 0);
  root.add(pump);

  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 12), matNozzle);
  nozzle.name = 'Nozzle_A';
  nozzle.rotation.x = Math.PI;
  nozzle.position.set(0.6, 0.55, 0);
  root.add(nozzle);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.08), matPanel);
  panel.name = 'ControlPanel';
  panel.position.set(-0.7, 0.5, 0.35);
  root.add(panel);

  return root;
}

function loadGlb(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => resolve(gltf), undefined, reject);
  });
}

function setModel(root, gltfAnimations = []) {
  if (modelRoot) scene.remove(modelRoot);
  modelRoot = root;
  scene.add(modelRoot);
  fitCameraToObject(modelRoot);
  animController.root = modelRoot;
  animController.defs = animationDefs;
  if (gltfAnimations.length > 0) {
    animController.init(gltfAnimations);
  } else {
    animController.init([]);
  }
}

function clearHighlight() {
  while (highlightRestore.length) {
    const { material, emissive, intensity } = highlightRestore.pop();
    material.emissive.copy(emissive);
    material.emissiveIntensity = intensity;
  }
  highlightedObject = null;
}

function highlightObject(obj) {
  clearHighlight();
  highlightedObject = obj;
  const cfg = viewerConfig?.highlight || {};
  const color = new THREE.Color(cfg.emissiveColor || '#3d9be9');
  const addIntensity = cfg.emissiveIntensity ?? 0.35;
  obj.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat.emissive) return;
      highlightRestore.push({
        material: mat,
        emissive: mat.emissive.clone(),
        intensity: mat.emissiveIntensity,
      });
      mat.emissive.copy(color);
      mat.emissiveIntensity = addIntensity;
    }
  });
}

function findPartForObject(object) {
  let current = object;
  while (current) {
    const part = partsByNode.get(current.name);
    if (part) return { part, object: current };
    current = current.parent;
  }
  return null;
}

function onPointerDown(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointerDown = { x: clientX, y: clientY, time: performance.now() };
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function onPointerUp(clientX, clientY) {
  const dx = clientX - pointerDown.x;
  const dy = clientY - pointerDown.y;
  const dist = Math.hypot(dx, dy);
  const dt = performance.now() - pointerDown.time;
  if (dist > 12 || dt > 400) return;
  if (!modelRoot) return;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(modelRoot, true);
  if (hits.length === 0) {
    clearHighlight();
    bomPanel.close();
    return;
  }
  const found = findPartForObject(hits[0].object);
  if (found) {
    highlightObject(found.object);
    bomPanel.open(found.part);
  } else {
    clearHighlight();
    bomPanel.close();
  }
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.isPrimary) onPointerDown(e.clientX, e.clientY);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.isPrimary) onPointerUp(e.clientX, e.clientY);
});

function resize() {
  const wrap = document.getElementById('canvas-wrap');
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  animController.update();
  renderer.render(scene, camera);
}

async function init() {
  resize();
  window.addEventListener('resize', resize);

  try {
    const [partsData, config] = await Promise.all([
      loadJson(PARTS_URL),
      loadJson(CONFIG_URL),
    ]);
    indexParts(partsData);
    applyConfig(config);

    const modelPath = config.modelPath || './assets/machine.glb';
    try {
      const gltf = await loadGlb(modelPath);
      setModel(gltf.scene, gltf.animations || []);
    } catch (glbErr) {
      console.warn('GLB não encontrado, usando demo:', glbErr);
      if (config.fallbackDemo !== false) {
        setModel(buildFallbackDemo(), []);
        showError('Modelo GLB ainda não exportado — exibindo pré-visualização demo.');
      } else {
        throw glbErr;
      }
    }
  } catch (err) {
    console.error(err);
    showError('Erro ao carregar o viewer. Verifique a conexão.');
    setModel(buildFallbackDemo(), []);
  } finally {
    hideLoading();
    animate();
  }
}

init();
