import * as THREE from 'three';

export class AnimationController {
  /**
   * @param {THREE.Object3D} root
   * @param {Array<{ clipName: string, label: string }>} animationDefs
   * @param {HTMLElement} buttonsContainer
   * @param {HTMLButtonElement} pauseBtn
   * @param {HTMLButtonElement} resetBtn
   */
  constructor(root, animationDefs, buttonsContainer, pauseBtn, resetBtn) {
    this.root = root;
    this.defs = animationDefs;
    this.buttonsContainer = buttonsContainer;
    this.pauseBtn = pauseBtn;
    this.resetBtn = resetBtn;
    /** @type {THREE.AnimationMixer | null} */
    this.mixer = null;
    /** @type {THREE.AnimationAction | null} */
    this.activeAction = null;
    /** @type {Map<string, THREE.AnimationClip>} */
    this.clips = new Map();
    this._clock = new THREE.Clock();
    this._buttons = [];
    this.pauseBtn.addEventListener('click', () => this.togglePause());
    this.resetBtn.addEventListener('click', () => this.resetPose());
  }

  /** @param {THREE.AnimationClip[]} clips */
  init(clips) {
    this.mixer = new THREE.AnimationMixer(this.root);
    for (const clip of clips) {
      this.clips.set(clip.name, clip);
    }
    this._buildButtons();
  }

  _buildButtons() {
    this.buttonsContainer.innerHTML = '';
    this._buttons = [];
    const available = this.defs.filter((d) => this.clips.has(d.clipName));
    if (available.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'anim-empty';
      empty.style.cssText = 'font-size:0.8rem;color:var(--text-muted);padding:0 8px;align-self:center';
      empty.textContent = 'Sem animações';
      this.buttonsContainer.appendChild(empty);
      return;
    }
    for (const def of available) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'anim-btn';
      btn.textContent = def.label || def.clipName;
      btn.dataset.clip = def.clipName;
      btn.addEventListener('click', () => this.play(def.clipName));
      this.buttonsContainer.appendChild(btn);
      this._buttons.push(btn);
    }
  }

  /** @param {string} clipName */
  play(clipName) {
    if (!this.mixer) return;
    const clip = this.clips.get(clipName);
    if (!clip) return;
    if (this.activeAction) {
      this.activeAction.stop();
    }
    this.activeAction = this.mixer.clipAction(clip);
    this.activeAction.reset();
    this.activeAction.setLoop(THREE.LoopOnce, 1);
    this.activeAction.clampWhenFinished = true;
    this.activeAction.play();
    this.pauseBtn.classList.remove('hidden');
    this.pauseBtn.textContent = 'Pause';
    this._setActiveButton(clipName);
  }

  togglePause() {
    if (!this.activeAction) return;
    if (this.activeAction.paused) {
      this.activeAction.paused = false;
      this.pauseBtn.textContent = 'Pause';
    } else {
      this.activeAction.paused = true;
      this.pauseBtn.textContent = 'Play';
    }
  }

  resetPose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.setTime(0);
    }
    this.activeAction = null;
    this.pauseBtn.classList.add('hidden');
    this._setActiveButton(null);
    if (this.root) {
      this.root.traverse((obj) => {
        if (obj.isSkinnedMesh) obj.skeleton.pose();
      });
    }
  }

  /** @param {string | null} clipName */
  _setActiveButton(clipName) {
    for (const btn of this._buttons) {
      btn.classList.toggle('active', btn.dataset.clip === clipName);
    }
  }

  update() {
    if (!this.mixer) return;
    const dt = this._clock.getDelta();
    this.mixer.update(dt);
  }
}
