/** @typedef {import('./viewer-types.js').PartEntry} PartEntry */

export class BomPanel {
  /** @param {object} els */
  constructor(els) {
    this.sheet = els.sheet;
    this.backdrop = els.backdrop;
    this.closeBtn = els.closeBtn;
    this.category = els.category;
    this.title = els.title;
    this.id = els.id;
    this.description = els.description;
    this.quantity = els.quantity;
    this._onClose = () => this.close();
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

  /** @param {PartEntry} part */
  open(part) {
    this.category.textContent = part.category || '—';
    this.title.textContent = part.displayName || part.nodeName;
    this.id.textContent = part.partId || '';
    this.description.textContent = part.description || '';
    this.quantity.textContent = String(part.quantity ?? 1);
    this.sheet.classList.add('open');
    this.sheet.setAttribute('aria-hidden', 'false');
    this.backdrop.classList.remove('hidden');
  }

  close() {
    this.sheet.classList.remove('open');
    this.sheet.setAttribute('aria-hidden', 'true');
    this.backdrop.classList.add('hidden');
  }
}
