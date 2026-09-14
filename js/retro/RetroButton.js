/**
 * RetroButton.js
 * Windows 95-style Button Component (Vanilla JS)
 */

export class RetroButton {
  constructor(options = {}) {
    this.options = {
      text: options.text || '',
      variant: options.variant || 'default', // 'default', 'primary', 'toolbar'
      icon: options.icon || null,
      active: options.active || false,
      disabled: options.disabled || false,
      onClick: options.onClick || null,
      className: options.className || ''
    };

    this.element = null;
    this.init();
  }

  init() {
    this.element = this.createButtonElement();
  }

  createButtonElement() {
    const button = document.createElement('button');
    
    // Build class list
    const classes = ['win95-button'];
    classes.push(`win95-button--${this.options.variant}`);
    if (this.options.active) classes.push('win95-button--active');
    if (this.options.disabled) classes.push('win95-button--disabled');
    if (this.options.className) classes.push(this.options.className);
    
    button.className = classes.join(' ');
    button.disabled = this.options.disabled;

    // Add icon if provided
    if (this.options.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'win95-button__icon';
      iconSpan.innerHTML = this.options.icon;
      button.appendChild(iconSpan);
    }

    // Add text if provided
    if (this.options.text) {
      const textSpan = document.createElement('span');
      textSpan.className = 'win95-button__text';
      textSpan.textContent = this.options.text;
      button.appendChild(textSpan);
    }

    // Add click handler
    if (this.options.onClick) {
      button.addEventListener('click', (e) => {
        if (!this.options.disabled) {
          this.options.onClick(e, this);
        }
      });
    }

    return button;
  }

  setText(text) {
    this.options.text = text;
    const textSpan = this.element.querySelector('.win95-button__text');
    if (textSpan) {
      textSpan.textContent = text;
    } else if (text) {
      const newTextSpan = document.createElement('span');
      newTextSpan.className = 'win95-button__text';
      newTextSpan.textContent = text;
      this.element.appendChild(newTextSpan);
    }
  }

  setIcon(icon) {
    this.options.icon = icon;
    const iconSpan = this.element.querySelector('.win95-button__icon');
    if (iconSpan) {
      iconSpan.innerHTML = icon;
    } else if (icon) {
      const newIconSpan = document.createElement('span');
      newIconSpan.className = 'win95-button__icon';
      newIconSpan.innerHTML = icon;
      this.element.insertBefore(newIconSpan, this.element.firstChild);
    }
  }

  setActive(active) {
    this.options.active = active;
    if (active) {
      this.element.classList.add('win95-button--active');
    } else {
      this.element.classList.remove('win95-button--active');
    }
  }

  setDisabled(disabled) {
    this.options.disabled = disabled;
    this.element.disabled = disabled;
    if (disabled) {
      this.element.classList.add('win95-button--disabled');
    } else {
      this.element.classList.remove('win95-button--disabled');
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
}

/**
 * Utility function to create a button quickly
 */
export function createRetroButton(text, onClick, options = {}) {
  return new RetroButton({
    text,
    onClick,
    ...options
  });
}
