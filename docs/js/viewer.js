import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BomPanel } from './bom-panel.js';
import { AnimationController } from './animations.js';
import { WaterJetSystem } from './water-jet.js';

const PARTS_URL = './data/parts.json';
const CONFIG_URL = './data/viewer-config.json';

let partsByNode = new Map();
let animationDefs = [];
let viewerConfig = null;
let modelRoot = null;
const highlightRestore = [];
let highlightedObject = null;
let systemOn = false;
let jetIntensity = 0.5;

let doorObj = null;
let doorOpen = false;

const canvas = document.getElementById('viewer-canvas');
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
  actions: document.getElementById('bom-actions'),
});

const animController = new AnimationController(
  null, [],
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
controls.enablePan = true;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const waterJets = new WaterJetSystem(scene);

bomPanel.onAction((action, data) => {
  if (action === 'toggle-power') {
    systemOn = data.on;
    bomPanel.setPowerState(systemOn);
    if (systemOn) {
      waterJets.turnOn();
      waterJets.setIntensity(jetIntensity);
    } else {
      waterJets.turnOff();
    }
    bomPanel.close();
    clearHighlight();
  }
  if (action === 'intensity-up') {
    jetIntensity = Math.min(1.0, jetIntensity + 0.1);
    waterJets.setIntensity(jetIntensity);
    bomPanel.setIntensityState(jetIntensity);
    data.label.textContent = `Intensity: ${Math.round(jetIntensity * 100)}%`;
  }
  if (action === 'intensity-down') {
    jetIntensity = Math.max(0.1, jetIntensity - 0.1);
    waterJets.setIntensity(jetIntensity);
    bomPanel.setIntensityState(jetIntensity);
    data.label.textContent = `Intensity: ${Math.round(jetIntensity * 100)}%`;
  }
  if (action === 'toggle-door') {
    toggleDoor();
    bomPanel.close();
    clearHighlight();
  }
});

bomPanel.onClose(() => {
  clearHighlight();
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = { x: 0, y: 0, time: 0 };

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
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
  const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 1.2), matBase);
  base.name = 'BasePlate';
  base.position.y = 0.075;
  root.add(base);
  return root;
}

function loadGlb(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => resolve(gltf), undefined, reject);
  });
}

function setupDoor(root) {
  const porta = root.getObjectByName('porta');
  if (!porta) return;
  doorObj = porta;
}

function toggleDoor() {
  if (!doorObj) return;
  doorOpen = !doorOpen;
  doorObj.visible = !doorOpen;
}

function setModel(root, gltfAnimations = []) {
  if (modelRoot) scene.remove(modelRoot);
  modelRoot = root;
  scene.add(modelRoot);
  fitCameraToObject(modelRoot);
  animController.root = modelRoot;
  animController.defs = animationDefs;
  animController.init(gltfAnimations);
  waterJets.attachToNozzles(modelRoot);
  setupDoor(modelRoot);
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
  waterJets.update();
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
      console.warn('GLB not found, using demo:', glbErr);
      if (config.fallbackDemo !== false) {
        setModel(buildFallbackDemo(), []);
        showError('GLB model not yet exported — showing demo preview.');
      } else {
        throw glbErr;
      }
    }
  } catch (err) {
    console.error(err);
    showError('Failed to load viewer. Check your connection.');
    setModel(buildFallbackDemo(), []);
  } finally {
    hideLoading();
    animate();
  }
}

init();
