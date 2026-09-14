/**
 * RetroContextMenu.js
 * Windows 95-style Context Menu Component (Vanilla JS)
 * Right-click context menu for desktop
 */

export class RetroContextMenu {
  constructor(options = {}) {
    this.options = {
      items: options.items || [],
      onClose: options.onClose || null
    };

    this.isOpen = false;
    this.element = null;
    this.clickOutsideHandler = null;
    this.contextMenuHandler = null;
    this.openTimeoutId = null;

    this.init();
  }

  init() {
    this.element = this.createMenuElement();
    this.updateMenuItems();
    this.hide();
  }

  createMenuElement() {
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    return menu;
  }

  updateMenuItems() {
    if (!this.element) return;

    this.element.innerHTML = '';

    this.options.items.forEach((item, index) => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'context-menu__separator';
        this.element.appendChild(separator);
      } else {
        const menuItem = this.createMenuItem(item, index);
        this.element.appendChild(menuItem);
      }
    });
  }

  createMenuItem(item, index) {
    const button = document.createElement('button');
    button.className = 'context-menu__item';
    button.dataset.itemIndex = index;

    if (item.disabled) {
      button.classList.add('context-menu__item--disabled');
      button.disabled = true;
    }

    if (item.icon) {
      const icon = document.createElement('span');
      icon.className = 'context-menu__item-icon';
      icon.innerHTML = item.icon;
      button.appendChild(icon);
    }

    const label = document.createElement('span');
    label.className = 'context-menu__item-label';
    label.textContent = item.label;
    button.appendChild(label);

    if (item.onClick && !item.disabled) {
      button.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        item.onClick(item, this);
        this.close();
      });
    }

    return button;
  }

  open(x, y) {
    if (this.isOpen) return;

    this.isOpen = true;
    this.element.style.display = 'block';
    
    // Position menu
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;

    // Ensure menu stays within viewport
    requestAnimationFrame(() => {
      const rect = this.element.getBoundingClientRect();
      
      if (rect.right > window.innerWidth) {
        this.element.style.left = `${x - rect.width}px`;
      }
      
      if (rect.bottom > window.innerHeight) {
        this.element.style.top = `${y - rect.height}px`;
      }
    });

    // Add click outside handler with a small delay.
    this.openTimeoutId = setTimeout(() => {
      this.openTimeoutId = null;
      if (!this.isOpen) return;

      this.clickOutsideHandler = this.handleClickOutside.bind(this);
      this.contextMenuHandler = this.handleRightClick.bind(this);
      document.addEventListener('mousedown', this.clickOutsideHandler);
      document.addEventListener('contextmenu', this.contextMenuHandler);
    }, 100);
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.element.style.display = 'none';

    if (this.openTimeoutId) {
      clearTimeout(this.openTimeoutId);
      this.openTimeoutId = null;
    }

    if (this.clickOutsideHandler) {
      document.removeEventListener('mousedown', this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }

    if (this.contextMenuHandler) {
      document.removeEventListener('contextmenu', this.contextMenuHandler);
      this.contextMenuHandler = null;
    }

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  handleClickOutside(event) {
    const target = event.target;

    // Don't close if clicking inside the menu
    if (this.element.contains(target)) {
      return;
    }

    this.close();
  }

  handleRightClick(event) {
    // Close on any right-click while menu is open
    this.close();
  }

  hide() {
    this.element.style.display = 'none';
  }

  setItems(items) {
    this.options.items = items;
    this.updateMenuItems();
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
    if (this.openTimeoutId) {
      clearTimeout(this.openTimeoutId);
      this.openTimeoutId = null;
    }
    if (this.clickOutsideHandler) {
      document.removeEventListener('mousedown', this.clickOutsideHandler);
    }
    if (this.contextMenuHandler) {
      document.removeEventListener('contextmenu', this.contextMenuHandler);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
