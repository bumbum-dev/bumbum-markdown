/**
 * RetroWindow.js
 * Windows 95-style Window Component (Vanilla JS)
 * Features draggable title bar, 3D borders, and window controls
 */

export class RetroWindow {
  constructor(options = {}) {
    this.options = {
      title: options.title || 'Window',
      width: options.width || 400,
      height: options.height || 300,
      initialX: options.initialX || 100,
      initialY: options.initialY || 100,
      icon: options.icon || null,
      resizable: options.resizable || false,
      minWidth: options.minWidth || 300,
      minHeight: options.minHeight || 200,
      zIndex: options.zIndex || 1,
      active: options.active !== false,
      onClose: options.onClose || null,
      onMinimize: options.onMinimize || null,
      onMaximize: options.onMaximize || null,
      onFocus: options.onFocus || null,
      onResize: options.onResize || null,
      content: options.content || null
    };

    this.position = { x: this.options.initialX, y: this.options.initialY };
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.isMaximized = false;
    this.element = null;
    this.contentElement = null;
    
    this.init();
  }

  init() {
    this.element = this.createWindowElement();
    this.attachEventListeners();
    this.updatePosition();
  }

  createWindowElement() {
    const windowEl = document.createElement('div');
    windowEl.className = `win95-window ${this.options.active ? 'win95-window--active' : ''}`;
    windowEl.style.width = `${this.options.width}px`;
    windowEl.style.height = `${this.options.height}px`;
    windowEl.style.zIndex = this.options.zIndex;

    // Title Bar
    const titleBar = document.createElement('div');
    titleBar.className = `win95-window__titlebar ${this.options.active ? 'titlebar-gradient' : 'titlebar-gradient-inactive'}`;
    
    const titleContent = document.createElement('div');
    titleContent.className = 'win95-window__title';
    
    if (this.options.icon) {
      const icon = document.createElement('span');
      icon.className = 'win95-window__icon';
      icon.innerHTML = this.options.icon;
      titleContent.appendChild(icon);
    }
    
    const titleText = document.createElement('span');
    titleText.className = 'text-title no-select';
    titleText.textContent = this.options.title;
    titleContent.appendChild(titleText);
    
    titleBar.appendChild(titleContent);

    // Window Controls
    const controls = document.createElement('div');
    controls.className = 'win95-window__controls';

    if (this.options.onMinimize) {
      const minimizeBtn = this.createControlButton('_', 'Minimize', () => {
        if (this.options.onMinimize) this.options.onMinimize(this);
      });
      controls.appendChild(minimizeBtn);
    }

    if (this.options.onMaximize) {
      const maximizeBtn = this.createControlButton('□', 'Maximize', () => {
        this.toggleMaximize();
      });
      this.maximizeBtn = maximizeBtn;
      controls.appendChild(maximizeBtn);
    }

    if (this.options.onClose) {
      const closeBtn = this.createControlButton('✕', 'Close', () => {
        if (this.options.onClose) this.options.onClose(this);
      });
      controls.appendChild(closeBtn);
    }

    titleBar.appendChild(controls);
    windowEl.appendChild(titleBar);

    // Content Area
    const content = document.createElement('div');
    content.className = 'win95-window__content';
    if (this.options.content) {
      if (typeof this.options.content === 'string') {
        content.innerHTML = this.options.content;
      } else if (this.options.content instanceof HTMLElement) {
        content.appendChild(this.options.content);
      }
    }
    this.contentElement = content;
    windowEl.appendChild(content);

    // Resize Handle (if resizable)
    if (this.options.resizable) {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'win95-window__resize-handle';
      windowEl.appendChild(resizeHandle);
      this.resizeHandle = resizeHandle;
    }

    this.titleBar = titleBar;
    return windowEl;
  }

  createControlButton(symbol, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'win95-window__control-btn';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    
    const icon = document.createElement('span');
    icon.className = 'win95-window__control-icon';
    icon.textContent = symbol;
    
    btn.appendChild(icon);
    btn.addEventListener('click', onClick);
    
    return btn;
  }

  attachEventListeners() {
    // Dragging
    this.titleBar.addEventListener('mousedown', this.handleMouseDown.bind(this));

    // Resizing (bottom-right corner handle, if resizable)
    if (this.resizeHandle) {
      this.resizeHandle.addEventListener('mousedown', this.handleResizeMouseDown.bind(this));
    }

    // Focus on click
    this.element.addEventListener('mousedown', () => {
      if (this.options.onFocus) {
        this.options.onFocus(this);
      }
    });
  }

  handleMouseDown(e) {
    if (this.isMaximized) return;
    
    const rect = this.element.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    this.isDragging = true;

    const handleMouseMove = (e) => {
      if (this.isDragging) {
        this.position = {
          x: e.clientX - this.dragOffset.x,
          y: e.clientY - this.dragOffset.y
        };
        this.updatePosition();
      }
    };

    const handleMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Begin a drag-resize from the bottom-right corner handle. Clamped to
   * options.minWidth/minHeight so the toolbar and split panels inside
   * never get squeezed into an unusable layout; not offered at all while
   * maximized (the handle already has no visible container to grab in
   * that state).
   */
  handleResizeMouseDown(e) {
    if (this.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = this.element.offsetWidth;
    const startHeight = this.element.offsetHeight;
    const maxWidth = window.innerWidth - this.position.x;
    const maxHeight = window.innerHeight - this.position.y;

    const handleMouseMove = (e) => {
      const newWidth = Math.min(maxWidth, Math.max(this.options.minWidth, startWidth + (e.clientX - startX)));
      const newHeight = Math.min(maxHeight, Math.max(this.options.minHeight, startHeight + (e.clientY - startY)));
      this.element.style.width = `${newWidth}px`;
      this.element.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Persist the final size so toggleMaximize()'s restore path snaps
      // back to what the user last set, not the original construction size.
      this.options.width = this.element.offsetWidth;
      this.options.height = this.element.offsetHeight;

      if (this.options.onResize) {
        this.options.onResize(this);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  updatePosition() {
    if (!this.isMaximized) {
      this.element.style.top = `${this.position.y}px`;
      this.element.style.left = `${this.position.x}px`;
    }
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    
    if (this.isMaximized) {
      this.element.style.top = '0';
      this.element.style.left = '0';
      this.element.style.width = '100%';
      this.element.style.height = 'calc(100vh - var(--taskbar-height, 32px))';
      if (this.maximizeBtn) {
        this.maximizeBtn.querySelector('.win95-window__control-icon').textContent = '❐';
        this.maximizeBtn.title = 'Restore';
      }
    } else {
      this.element.style.width = `${this.options.width}px`;
      this.element.style.height = `${this.options.height}px`;
      this.updatePosition();
      if (this.maximizeBtn) {
        this.maximizeBtn.querySelector('.win95-window__control-icon').textContent = '□';
        this.maximizeBtn.title = 'Maximize';
      }
    }

    if (this.options.onMaximize) {
      this.options.onMaximize(this, this.isMaximized);
    }
  }

  setActive(active) {
    this.options.active = active;
    if (active) {
      this.element.classList.add('win95-window--active');
      this.titleBar.classList.remove('titlebar-gradient-inactive');
      this.titleBar.classList.add('titlebar-gradient');
    } else {
      this.element.classList.remove('win95-window--active');
      this.titleBar.classList.remove('titlebar-gradient');
      this.titleBar.classList.add('titlebar-gradient-inactive');
    }
  }

  setZIndex(zIndex) {
    this.options.zIndex = zIndex;
    this.element.style.zIndex = zIndex;
  }

  focus() {
    let maxZ = 100;
    document.querySelectorAll('.win95-window').forEach((el) => {
      if (el === this.element) return;
      const z = parseInt(el.style.zIndex, 10) || 0;
      if (z > maxZ) maxZ = z;
    });
    this.setZIndex(maxZ + 1);
    this.setActive(true);

    if (this.options.onFocus) {
      this.options.onFocus(this);
    }
  }

  setTitle(title) {
    this.options.title = title;
    const titleText = this.titleBar.querySelector('.text-title');
    if (titleText) {
      titleText.textContent = title;
    }
  }

  setContent(content) {
    this.contentElement.innerHTML = '';
    if (typeof content === 'string') {
      this.contentElement.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.contentElement.appendChild(content);
    }
  }

  appendContent(content) {
    if (typeof content === 'string') {
      this.contentElement.insertAdjacentHTML('beforeend', content);
    } else if (content instanceof HTMLElement) {
      this.contentElement.appendChild(content);
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
