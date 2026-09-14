/**
 * RetroStartMenu.js
 * Windows 95-style Start Menu Component (Vanilla JS)
 * Popup menu from Start button with menu items and submenus
 */

export class RetroStartMenu {
  constructor(options = {}) {
    this.options = {
      items: options.items || [],
      onClose: options.onClose || null
    };

    this._isOpen = false;
    this.element = null;
    this.clickOutsideHandler = null;
    this.activeSubmenu = null;
    this.submenuTimeout = null;
    this.openTimeoutId = null;

    this.init();
  }

  init() {
    this.element = this.createMenuElement();
    this.hide();
  }

  createMenuElement() {
    const menu = document.createElement('div');
    menu.className = 'start-menu';

    // Menu Items Container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'start-menu__items';
    
    this.options.items.forEach((item, index) => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'start-menu__separator';
        itemsContainer.appendChild(separator);
      } else {
        const menuItem = this.createMenuItem(item, index);
        itemsContainer.appendChild(menuItem);
      }
    });

    menu.appendChild(itemsContainer);

    return menu;
  }

  createMenuItem(item, index) {
    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'start-menu__item-wrapper';
    itemWrapper.dataset.itemIndex = index;

    const button = document.createElement('button');
    button.className = 'start-menu__item';

    if (item.icon) {
      const icon = document.createElement('span');
      icon.className = 'start-menu__item-icon';
      icon.innerHTML = item.icon;
      button.appendChild(icon);
    }

    const label = document.createElement('span');
    label.className = 'start-menu__item-label';
    label.textContent = item.label;
    button.appendChild(label);

    // Add submenu arrow if item has submenu
    if (item.submenu && item.submenu.length > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'start-menu__item-arrow';
      arrow.innerHTML = '▶';
      button.appendChild(arrow);
      button.classList.add('start-menu__item--has-submenu');

      // Create submenu
      const submenu = this.createSubmenu(item.submenu);
      itemWrapper.appendChild(submenu);

      // Submenu hover handlers
      button.addEventListener('mouseenter', () => {
        this.showSubmenu(itemWrapper, submenu);
      });

      itemWrapper.addEventListener('mouseleave', () => {
        this.hideSubmenu(submenu);
      });
    } else if (item.onClick) {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        item.onClick(item, this);
        this.close();
      });
    }

    itemWrapper.appendChild(button);
    return itemWrapper;
  }

  createSubmenu(items) {
    const submenu = document.createElement('div');
    submenu.className = 'start-menu__submenu';

    items.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'start-menu__separator';
        submenu.appendChild(separator);
      } else {
        const submenuItem = document.createElement('button');
        submenuItem.className = 'start-menu__submenu-item';

        if (item.icon) {
          const icon = document.createElement('span');
          icon.className = 'start-menu__item-icon';
          icon.innerHTML = item.icon;
          submenuItem.appendChild(icon);
        }

        const label = document.createElement('span');
        label.className = 'start-menu__item-label';
        label.textContent = item.label;
        submenuItem.appendChild(label);

        if (item.onClick) {
          submenuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            item.onClick(item, this);
            this.close();
          });
        }

        submenu.appendChild(submenuItem);
      }
    });

    return submenu;
  }

  showSubmenu(itemWrapper, submenu) {
    // Clear any pending hide timeout
    if (this.submenuTimeout) {
      clearTimeout(this.submenuTimeout);
      this.submenuTimeout = null;
    }

    // Hide any other active submenu
    if (this.activeSubmenu && this.activeSubmenu !== submenu) {
      this.activeSubmenu.style.display = 'none';
    }

    // Show this submenu
    submenu.style.display = 'block';
    this.activeSubmenu = submenu;

    // Position submenu
    const rect = itemWrapper.getBoundingClientRect();
    const submenuRect = submenu.getBoundingClientRect();
    
    // Check if submenu fits on the right
    if (rect.right + submenuRect.width > window.innerWidth) {
      // Position on the left instead
      submenu.style.left = 'auto';
      submenu.style.right = '100%';
    } else {
      submenu.style.left = '100%';
      submenu.style.right = 'auto';
    }
  }

  hideSubmenu(submenu) {
    // Delay hiding to allow moving mouse to submenu
    this.submenuTimeout = setTimeout(() => {
      submenu.style.display = 'none';
      if (this.activeSubmenu === submenu) {
        this.activeSubmenu = null;
      }
    }, 200);
  }

  open() {
    if (this._isOpen) return;
    
    this._isOpen = true;
    this.element.style.display = '';
    
    // Hide all submenus when opening
    this.hideAllSubmenus();
    
    // Add click outside handler with a small delay.
    this.openTimeoutId = setTimeout(() => {
      this.openTimeoutId = null;
      if (!this._isOpen) return;

      this.clickOutsideHandler = this.handleClickOutside.bind(this);
      document.addEventListener('mousedown', this.clickOutsideHandler);
    }, 100);
  }

  close() {
    if (!this._isOpen) return;
    
    this._isOpen = false;
    this.element.style.display = 'none';
    
    // Hide all submenus
    this.hideAllSubmenus();

    if (this.openTimeoutId) {
      clearTimeout(this.openTimeoutId);
      this.openTimeoutId = null;
    }

    if (this.clickOutsideHandler) {
      document.removeEventListener('mousedown', this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }

    if (this.submenuTimeout) {
      clearTimeout(this.submenuTimeout);
      this.submenuTimeout = null;
    }

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  hideAllSubmenus() {
    const submenus = this.element.querySelectorAll('.start-menu__submenu');
    submenus.forEach(submenu => {
      submenu.style.display = 'none';
    });
    this.activeSubmenu = null;
  }

  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  handleClickOutside(event) {
    const target = event.target;
    
    // Don't close if clicking inside the menu
    if (this.element.contains(target)) {
      return;
    }

    // Don't close if clicking on the Start button
    const isStartButton = target.closest('.win95-taskbar__start');
    if (isStartButton) {
      return;
    }

    this.close();
  }

  updateItems(items) {
    this.options.items = items;
    
    // Rebuild items container
    const itemsContainer = this.element.querySelector('.start-menu__items');
    if (itemsContainer) {
      itemsContainer.innerHTML = '';
      
      items.forEach((item, index) => {
        if (item.separator) {
          const separator = document.createElement('div');
          separator.className = 'start-menu__separator';
          itemsContainer.appendChild(separator);
        } else {
          const menuItem = this.createMenuItem(item, index);
          itemsContainer.appendChild(menuItem);
        }
      });
    }
  }

  addItem(item, position = -1) {
    if (position === -1 || position >= this.options.items.length) {
      this.options.items.push(item);
    } else {
      this.options.items.splice(position, 0, item);
    }
    this.updateItems(this.options.items);
  }

  removeItem(index) {
    if (index >= 0 && index < this.options.items.length) {
      this.options.items.splice(index, 1);
      this.updateItems(this.options.items);
    }
  }

  hide() {
    this.element.style.display = 'none';
  }

  show() {
    this.element.style.display = '';
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
    }
    if (this.clickOutsideHandler) {
      document.removeEventListener('mousedown', this.clickOutsideHandler);
    }
    if (this.submenuTimeout) {
      clearTimeout(this.submenuTimeout);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  isOpen() {
    return this._isOpen;
  }
}
