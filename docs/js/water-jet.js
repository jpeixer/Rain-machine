import * as THREE from 'three';

const PARTICLES_PER_JET = 180;
const GRAVITY = -4.8;

export class WaterJetSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.intensity = 0.5;
    this.jets = [];
    this._clock = new THREE.Clock(false);
  }

  attachToNozzles(modelRoot) {
    if (!modelRoot) return;
    const nozzleGroup = modelRoot.getObjectByName('nozzle');
    if (!nozzleGroup) return;

    for (const child of nozzleGroup.children) {
      if (child.children.length > 0 || child.isMesh) {
        this._createJet(child);
      }
    }
  }

  _createJet(nozzleObj) {
    const origin = new THREE.Vector3();
    nozzleObj.getWorldPosition(origin);

    const direction = new THREE.Vector3(0, 0, 1);
    nozzleObj.getWorldDirection(direction);
    direction.normalize();

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLES_PER_JET * 3);
    const ages = new Float32Array(PARTICLES_PER_JET);

    for (let i = 0; i < PARTICLES_PER_JET; i++) {
      ages[i] = -1;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x7ec8f0,
      size: 0.018,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    this.scene.add(points);

    this.jets.push({
      points,
      geo,
      mat,
      ages,
      origin: origin.clone(),
      direction: direction.clone(),
      spawnAccum: 0,
    });
  }

  turnOn() {
    this.active = true;
    this._clock.start();
    for (const jet of this.jets) {
      jet.points.visible = true;
      for (let i = 0; i < PARTICLES_PER_JET; i++) {
        jet.ages[i] = -1;
      }
    }
  }

  turnOff() {
    this.active = false;
    this._clock.stop();
    for (const jet of this.jets) {
      jet.points.visible = false;
    }
  }

  setIntensity(value) {
    this.intensity = Math.max(0.1, Math.min(1.0, value));
    for (const jet of this.jets) {
      jet.mat.opacity = 0.5 + this.intensity * 0.4;
      jet.mat.size = 0.012 + this.intensity * 0.014;
    }
  }

  update() {
    if (!this.active) return;
    const dt = this._clock.getDelta();
    if (dt <= 0 || dt > 0.1) return;

    const speed = 2.0 + this.intensity * 4.0;
    const maxLife = 1.2;
    const spawnRate = 80 + this.intensity * 120;
    const spread = 0.015;

    for (const jet of this.jets) {
      const posAttr = jet.geo.getAttribute('position');
      const pos = posAttr.array;
      const ages = jet.ages;

      jet.spawnAccum += dt * spawnRate;
      let toSpawn = Math.floor(jet.spawnAccum);
      jet.spawnAccum -= toSpawn;

      for (let i = 0; i < PARTICLES_PER_JET; i++) {
        if (ages[i] < 0 && toSpawn > 0) {
          toSpawn--;
          ages[i] = 0;
          const i3 = i * 3;
          pos[i3] = jet.origin.x + (Math.random() - 0.5) * spread;
          pos[i3 + 1] = jet.origin.y + (Math.random() - 0.5) * spread;
          pos[i3 + 2] = jet.origin.z + (Math.random() - 0.5) * spread;
          continue;
        }

        if (ages[i] < 0) continue;

        ages[i] += dt;
        if (ages[i] > maxLife) {
          ages[i] = -1;
          const i3 = i * 3;
          pos[i3] = jet.origin.x;
          pos[i3 + 1] = jet.origin.y;
          pos[i3 + 2] = jet.origin.z;
          continue;
        }

        const t = ages[i];
        const i3 = i * 3;
        const jitter = (Math.random() - 0.5) * 0.002;

        pos[i3] = jet.origin.x + jet.direction.x * speed * t + jitter;
        pos[i3 + 1] = jet.origin.y + jet.direction.y * speed * t + 0.5 * GRAVITY * t * t;
        pos[i3 + 2] = jet.origin.z + jet.direction.z * speed * t + jitter;
      }

      posAttr.needsUpdate = true;
    }
  }
}
