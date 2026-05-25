import * as THREE from 'three';

const PARTICLE_COUNT = 120;
const JET_LENGTH = 0.6;
const SPREAD = 0.08;

export class WaterJetSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.intensity = 0.5;
    this.jets = [];
    this._clock = new THREE.Clock();
  }

  attachToNozzles(modelRoot) {
    if (!modelRoot) return;
    const nozzleParent = modelRoot.getObjectByName('nozzle');
    if (!nozzleParent) return;

    nozzleParent.traverse((child) => {
      if (child.isMesh) {
        this._createJet(child);
      }
    });
  }

  _createJet(nozzleMesh) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const lifetimes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this._resetParticle(positions, velocities, lifetimes, i);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x5cb8ff,
      size: 0.012,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.visible = false;

    const worldPos = new THREE.Vector3();
    nozzleMesh.getWorldPosition(worldPos);
    points.position.copy(worldPos);

    const worldDir = new THREE.Vector3(0, -1, 0);
    nozzleMesh.getWorldDirection(worldDir);

    this.scene.add(points);
    this.jets.push({ points, geo, mat, velocities, lifetimes, direction: worldDir.clone(), origin: worldPos.clone() });
  }

  _resetParticle(positions, velocities, lifetimes, i) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 1] = 0;
    positions[i3 + 2] = (Math.random() - 0.5) * SPREAD;
    velocities[i3] = (Math.random() - 0.5) * 0.3;
    velocities[i3 + 1] = -(Math.random() * 2 + 1);
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
    lifetimes[i] = Math.random();
  }

  turnOn() {
    this.active = true;
    for (const jet of this.jets) {
      jet.points.visible = true;
    }
  }

  turnOff() {
    this.active = false;
    for (const jet of this.jets) {
      jet.points.visible = false;
    }
  }

  setIntensity(value) {
    this.intensity = Math.max(0.1, Math.min(1.0, value));
    for (const jet of this.jets) {
      jet.mat.opacity = 0.4 + this.intensity * 0.5;
      jet.mat.size = 0.008 + this.intensity * 0.012;
    }
  }

  update() {
    if (!this.active) return;
    const dt = this._clock.getDelta();
    const speed = this.intensity * 2.5;

    for (const jet of this.jets) {
      const posAttr = jet.geo.getAttribute('position');
      const pos = posAttr.array;
      const vel = jet.velocities;
      const life = jet.lifetimes;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        life[i] += dt * speed;

        if (life[i] > 1.0) {
          this._resetParticle(pos, vel, life, i);
        } else {
          pos[i3] += vel[i3] * dt * speed * SPREAD * 3;
          pos[i3 + 1] += vel[i3 + 1] * dt * speed * JET_LENGTH;
          pos[i3 + 2] += vel[i3 + 2] * dt * speed * SPREAD * 3;
          pos[i3 + 1] -= dt * 0.5;
        }
      }
      posAttr.needsUpdate = true;
    }
  }
}
