/**
 * RetroDesktopIcon.js
 * Windows 95-style Desktop Icon Component (Vanilla JS)
 * Icon with label, double-click to open, single-click selection
 */

export class RetroDesktopIcon {
  constructor(options = {}) {
    this.options = {
      icon: options.icon || '📄',
      label: options.label || 'Icon',
      onDoubleClick: options.onDoubleClick || null,
      onClick: options.onClick || null,
      x: options.x || 0,
      y: options.y || 0,
      className: options.className || ''
    };

    this.element = null;
    this.selected = false;

    this.init();
  }

  init() {
    this.element = this.createIconElement();
  }

  createIconElement() {
    const icon = document.createElement('div');
    icon.className = `desktop-icon ${this.options.className}`.trim();
    
    // Position
    if (this.options.x !== 0 || this.options.y !== 0) {
      icon.style.position = 'absolute';
      icon.style.left = `${this.options.x}px`;
      icon.style.top = `${this.options.y}px`;
    }

    // Icon Image
    const iconImage = document.createElement('div');
    iconImage.className = 'desktop-icon-image';
    iconImage.innerHTML = this.options.icon;
    icon.appendChild(iconImage);

    // Icon Label
    const iconLabel = document.createElement('div');
    iconLabel.className = 'desktop-icon-label';
    iconLabel.textContent = this.options.label;
    icon.appendChild(iconLabel);

    // Event handlers
    icon.addEventListener('click', this.handleClick.bind(this));
    icon.addEventListener('dblclick', this.handleDoubleClick.bind(this));

    return icon;
  }

  handleClick(e) {
    e.stopPropagation();

    // Double-click detection is left entirely to the native 'dblclick'
    // listener below - a real double-click still fires this handler twice
    // first (that's how 'click'/'dblclick' work in the DOM), but select()
    // and onClick are idempotent, so that's harmless. Previously this also
    // manually re-detected a double-click via a timestamp and called
    // handleDoubleClick() itself, which meant onDoubleClick fired *twice*
    // per real double-click (once from here, once from 'dblclick') -
    // harmless for callbacks that just open/focus a window, but broke
    // RetroDialog's single-active-dialog tracking when the callback opened
    // a confirm dialog (see openDemoMarkdown), leaking its backdrop.
    this.select();

    if (this.options.onClick) {
      this.options.onClick(this);
    }
  }

  handleDoubleClick(e) {
    e.stopPropagation();
    
    if (this.options.onDoubleClick) {
      this.options.onDoubleClick(this);
    }
  }

  select() {
    this.selected = true;
    this.element.classList.add('desktop-icon--selected');
  }

  deselect() {
    this.selected = false;
    this.element.classList.remove('desktop-icon--selected');
  }

  toggleSelection() {
    if (this.selected) {
      this.deselect();
    } else {
      this.select();
    }
  }

  setPosition(x, y) {
    this.options.x = x;
    this.options.y = y;
    this.element.style.position = 'absolute';
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  setIcon(icon) {
    this.options.icon = icon;
    const iconImage = this.element.querySelector('.desktop-icon-image');
    if (iconImage) {
      iconImage.innerHTML = icon;
    }
  }

  setLabel(label) {
    this.options.label = label;
    const iconLabel = this.element.querySelector('.desktop-icon-label');
    if (iconLabel) {
      iconLabel.textContent = label;
    }
  }

  mount(parent) {
    if (typeof parent === 'string') {
      parent = document.querySelector(parent);
    }
    if (parent) {
      parent.appendChild(this.element);
    }
    return this;
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  hide() {
    this.element.style.display = 'none';
  }

  show() {
    this.element.style.display = '';
  }
}
