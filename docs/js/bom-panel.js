export class BomPanel {
  constructor(els) {
    this.sheet = els.sheet;
    this.backdrop = els.backdrop;
    this.closeBtn = els.closeBtn;
    this.category = els.category;
    this.title = els.title;
    this.id = els.id;
    this.description = els.description;
    this.quantity = els.quantity;
    this.actions = els.actions;
    this._onClose = () => this.close();
    this._currentPart = null;
    this._onAction = null;
    this.closeBtn.addEventListener('click', this._onClose);
    this.backdrop.addEventListener('click', this._onClose);
    this._touchStartY = 0;
    this.sheet.addEventListener('touchstart', (e) => {
      this._touchStartY = e.touches[0].clientY;
    }, { passive: true });
    this.sheet.addEventListener('touchend', (e) => {
      const dy = e.changedTouches[0].clientY - this._touchStartY;
      if (dy > 60) this.close();
    }, { passive: true });
  }

  onAction(callback) {
    this._onAction = callback;
  }

  open(part) {
    this._currentPart = part;
    this.category.textContent = part.category || '—';
    this.title.textContent = part.displayName || part.nodeName;
    this.id.textContent = part.partId || '';
    this.description.textContent = part.description || '';
    this.quantity.textContent = String(part.quantity ?? 1);
    this._buildActions(part);
    this.sheet.classList.add('open');
    this.sheet.setAttribute('aria-hidden', 'false');
    this.backdrop.classList.remove('hidden');
  }

  _buildActions(part) {
    this.actions.innerHTML = '';
    const nodeName = part.nodeName || '';

    if (nodeName === 'ligadesliga') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bom-action-btn bom-action-btn--toggle';
      btn.dataset.action = 'toggle-power';
      btn.textContent = 'Ligar';
      btn.addEventListener('click', () => {
        const isOn = btn.classList.toggle('active');
        btn.textContent = isOn ? 'Desligar' : 'Ligar';
        if (this._onAction) this._onAction('toggle-power', { on: isOn });
      });
      this.actions.appendChild(btn);
    }

    if (nodeName === 'valvulas' || nodeName === 'controle') {
      const wrap = document.createElement('div');
      wrap.className = 'bom-action-intensity';

      const label = document.createElement('span');
      label.className = 'bom-action-label';
      label.textContent = 'Intensidade: 50%';

      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'bom-action-btn bom-action-btn--sm';
      minus.textContent = '−';
      minus.addEventListener('click', () => {
        if (this._onAction) this._onAction('intensity-down', { label });
      });

      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'bom-action-btn bom-action-btn--sm';
      plus.textContent = '+';
      plus.addEventListener('click', () => {
        if (this._onAction) this._onAction('intensity-up', { label });
      });

      wrap.appendChild(minus);
      wrap.appendChild(label);
      wrap.appendChild(plus);
      this.actions.appendChild(wrap);
    }
  }

  updatePowerState(isOn) {
    const btn = this.actions.querySelector('[data-action="toggle-power"]');
    if (btn) {
      btn.classList.toggle('active', isOn);
      btn.textContent = isOn ? 'Desligar' : 'Ligar';
    }
  }

  close() {
    this.sheet.classList.remove('open');
    this.sheet.setAttribute('aria-hidden', 'true');
    this.backdrop.classList.add('hidden');
  }
}
