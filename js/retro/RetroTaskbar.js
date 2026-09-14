/**
 * RetroTaskbar.js
 * Windows 95-style Taskbar Component (Vanilla JS)
 * Features Start button, task items, and system tray
 */

export class RetroTaskbar {
  constructor(options = {}) {
    this.options = {
      onStartClick: options.onStartClick || null,
      showClock: options.showClock !== false,
      className: options.className || ''
    };

    this.tasks = [];
    this.element = null;
    this.tasksContainer = null;
    this.clockElement = null;
    this.clockInterval = null;

    this.init();
  }

  init() {
    this.element = this.createTaskbarElement();
    if (this.options.showClock) {
      this.startClock();
    }
  }

  createTaskbarElement() {
    const taskbar = document.createElement('div');
    taskbar.className = `win95-taskbar ${this.options.className}`.trim();

    // Start Button
    const startButton = document.createElement('button');
    startButton.className = 'win95-taskbar__start';
    
    const startIcon = document.createElement('span');
    startIcon.className = 'win95-taskbar__start-icon';
    startIcon.textContent = '🪟';
    
    const startText = document.createElement('span');
    startText.className = 'win95-taskbar__start-text';
    startText.textContent = 'Start';
    
    startButton.appendChild(startIcon);
    startButton.appendChild(startText);
    
    if (this.options.onStartClick) {
      startButton.addEventListener('click', (e) => {
        this.options.onStartClick(e, this);
      });
    }
    
    taskbar.appendChild(startButton);

    // Task Items Container
    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'win95-taskbar__tasks';
    this.tasksContainer = tasksContainer;
    taskbar.appendChild(tasksContainer);

    // System Tray
    const tray = document.createElement('div');
    tray.className = 'win95-taskbar__tray';

    if (this.options.showClock) {
      const clock = document.createElement('div');
      clock.className = 'win95-taskbar__clock';
      clock.textContent = this.formatTime(new Date());
      this.clockElement = clock;
      tray.appendChild(clock);
    }

    taskbar.appendChild(tray);

    return taskbar;
  }

  formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  startClock() {
    this.updateClock();
    this.clockInterval = setInterval(() => {
      this.updateClock();
    }, 1000);
  }

  updateClock() {
    if (this.clockElement) {
      this.clockElement.textContent = this.formatTime(new Date());
    }
  }

  addTask(task) {
    const taskButton = document.createElement('button');
    taskButton.className = `win95-taskbar__task ${task.active ? 'win95-taskbar__task--active' : ''}`;
    taskButton.dataset.taskId = task.id;

    if (task.icon) {
      const icon = document.createElement('span');
      icon.className = 'win95-taskbar__task-icon';
      icon.innerHTML = task.icon;
      taskButton.appendChild(icon);
    }

    const title = document.createElement('span');
    title.className = 'win95-taskbar__task-title';
    title.textContent = task.title;
    taskButton.appendChild(title);

    if (task.onClick) {
      taskButton.addEventListener('click', () => {
        task.onClick(task.id, this);
      });
    }

    this.tasksContainer.appendChild(taskButton);
    this.tasks.push({ ...task, element: taskButton });

    return taskButton;
  }

  removeTask(taskId) {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const task = this.tasks[taskIndex];
      if (task.element && task.element.parentNode) {
        task.element.parentNode.removeChild(task.element);
      }
      this.tasks.splice(taskIndex, 1);
    }
  }

  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Update task data
    Object.assign(task, updates);

    // Update DOM
    if (task.element) {
      if (updates.active !== undefined) {
        if (updates.active) {
          task.element.classList.add('win95-taskbar__task--active');
        } else {
          task.element.classList.remove('win95-taskbar__task--active');
        }
      }

      if (updates.title !== undefined) {
        const titleElement = task.element.querySelector('.win95-taskbar__task-title');
        if (titleElement) {
          titleElement.textContent = updates.title;
        }
      }

      if (updates.icon !== undefined) {
        const iconElement = task.element.querySelector('.win95-taskbar__task-icon');
        if (iconElement) {
          iconElement.innerHTML = updates.icon;
        }
      }
    }
  }

  /**
   * Update all tasks at once (batch update)
   * Syncs taskbar with provided task items array
   * @param {Array} items - Array of task items with { id, title, icon, active, minimized, onClick }
   */
  updateTasks(items) {
    // Create a set of IDs from the new items
    const newIds = new Set(items.map(item => item.id));
    
    // Remove tasks that are no longer in the items array
    const tasksToRemove = this.tasks.filter(task => !newIds.has(task.id));
    tasksToRemove.forEach(task => this.removeTask(task.id));
    
    // Update or add tasks
    items.forEach(item => {
      const existingTask = this.tasks.find(t => t.id === item.id);
      
      if (existingTask) {
        // Update existing task
        this.updateTask(item.id, {
          title: item.title,
          icon: item.icon,
          active: item.active,
          minimized: item.minimized
        });
      } else {
        // Add new task
        this.addTask(item);
      }
    });
  }

  setActiveTask(taskId) {
    this.tasks.forEach(task => {
      if (task.element) {
        if (task.id === taskId) {
          task.element.classList.add('win95-taskbar__task--active');
          task.active = true;
        } else {
          task.element.classList.remove('win95-taskbar__task--active');
          task.active = false;
        }
      }
    });
  }

  clearAllTasks() {
    this.tasks.forEach(task => {
      if (task.element && task.element.parentNode) {
        task.element.parentNode.removeChild(task.element);
      }
    });
    this.tasks = [];
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
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
