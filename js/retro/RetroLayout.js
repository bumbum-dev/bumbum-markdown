/**
 * RetroLayout - Main Layout Controller
 * Windows 95-style desktop environment with window management
 */

import { RetroTaskbar } from './RetroTaskbar.js';
import { RetroStartMenu } from './RetroStartMenu.js';
import { RetroDesktopIcon } from './RetroDesktopIcon.js';
import { RetroContextMenu } from './RetroContextMenu.js';
import { RetroState } from './RetroState.js';
import { RetroWindowContent } from './RetroWindowContent.js';
import retroDialog from './RetroDialog.js';

export class RetroLayout {
    constructor() {
        this.state = new RetroState();
        this.windows = new Map(); 
        this.desktopIcons = new Map();
        this.taskbar = null;
        this.startMenu = null;
        this.contextMenu = null;
        this.editorContextMenu = null;
        this.editorContextMenuPosition = null;
        this.container = null;
        this.desktop = null;
        this.windowsContainer = null;
        this.content = new RetroWindowContent(this);
        
        this.init();
    }

    /**
     * Open the main editor window.
     */
    openMainWindow() {
        this.content.openMainWindow();
    }

    /**
     * Initialize the retro layout
     */
    init() {
        // Create main layout structure
        this.createLayout();
        
        // Initialize taskbar
        this.initTaskbar();
        
        // Initialize start menu
        this.initStartMenu();
        
        // Initialize context menu
        this.initContextMenu();
        
        // Initialize desktop icons
        this.initDesktopIcons();
        
        // Setup desktop right-click handler
        this.setupDesktopContextMenu();

        // Setup editor right-click handler
        this.setupEditorContextMenu();

        // Setup desktop background click handler (deselect icons)
        this.setupDesktopClickHandler();
        
        // Subscribe to state changes
        this.state.subscribe(this.handleStateChange.bind(this));
        
        // Intercept header button clicks
        this.interceptHeaderButtons();
    }

    /**
     * Intercept header button clicks to open windows
     */
    interceptHeaderButtons() {
        // Intercept Settings button
        const settingsToggle = document.getElementById('settings-toggle');
        if (settingsToggle) {
            settingsToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.content.openSettingsWindow();
            });
        }
        
        // Intercept Images toggle
        const imagesToggle = document.getElementById('images-toggle');
        if (imagesToggle) {
            imagesToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.content.openImagesWindow();
            });
        }
    }

    /**
     * Create the main layout structure
     */
    createLayout() {
        // Add retro mode class to body
        document.body.classList.add('retro-mode');
        
        // Get or create container
        this.container = document.querySelector('.retro-layout');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'retro-layout';
            
            // Move existing app-container inside
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                appContainer.style.display = 'none'; // We'll show it in a window
            }
            
            document.body.appendChild(this.container);
        }
        
        // Create desktop area
        this.desktop = document.createElement('div');
        this.desktop.className = 'retro-desktop';
        this.container.appendChild(this.desktop);
        
        // Create windows container
        this.windowsContainer = document.createElement('div');
        this.windowsContainer.className = 'retro-windows-container';
        this.desktop.appendChild(this.windowsContainer);
        
        // Create desktop icons container
        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'desktop-icons';
        iconsContainer.id = 'desktop-icons';
        this.desktop.appendChild(iconsContainer);
        
        // Create system info area
        const systemInfo = document.createElement('div');
        systemInfo.className = 'retro-system-info';
        systemInfo.innerHTML = '<div class="retro-user-info">Markdown to PDF</div>';
        this.desktop.appendChild(systemInfo);
    }

    /**
     * Initialize taskbar
     */
    initTaskbar() {
        this.taskbar = new RetroTaskbar({
            onStartClick: () => this.toggleStartMenu(),
            onTaskClick: (windowId) => this.handleTaskbarClick(windowId)
        });
        
        this.taskbar.mount(this.container);
    }

    /**
     * Initialize start menu
     */
    initStartMenu() {
        const menuItems = [
            { label: 'New Document', icon: '📝', onClick: () => this.content.handleMenuAction('new-document') },
            { label: 'Open File...', icon: '📁', onClick: () => this.content.handleMenuAction('open-file') },
            { label: 'Save', icon: '💾', onClick: () => this.content.handleMenuAction('save') },
            { separator: true },
            { label: 'Images', icon: '📷', onClick: () => this.content.handleMenuAction('images') },
            { separator: true },
            { label: 'Settings', icon: '⚙️', onClick: () => this.content.handleMenuAction('settings') },
            { label: 'Retro Effects', icon: '🖥️', onClick: () => this.content.handleMenuAction('retro-effects') },
            { separator: true },
            { label: 'Manual', icon: '📖', onClick: () => this.content.handleMenuAction('manual') },
            { label: 'Help', icon: '❓', onClick: () => this.content.handleMenuAction('help') },
            { label: 'About', icon: 'ℹ️', onClick: () => this.content.handleMenuAction('about') },
            { label: 'GitHub', icon: '🐙', onClick: () => this.content.handleMenuAction('github') }
        ];
        
        this.startMenu = new RetroStartMenu({
            items: menuItems,
            onClose: () => this.closeStartMenu()
        });
        
        this.startMenu.mount(this.container);
    }

    /**
     * Initialize context menu
     */
    initContextMenu() {
        const menuItems = [
            { label: 'Arrange Icons', icon: '📐', onClick: () => this.arrangeIcons(), disabled: true },
            { label: 'Refresh', icon: '🔄', onClick: () => this.refreshDesktop() },
            { separator: true },
            { label: 'New Document', icon: '📝', onClick: () => this.content.handleMenuAction('new-document') },
            { separator: true },
            { label: 'Properties', icon: 'ℹ️', onClick: () => this.showDesktopProperties(), disabled: true }
        ];
        
        this.contextMenu = new RetroContextMenu({
            items: menuItems,
            onClose: () => {}
        });
        
        this.contextMenu.mount(this.container);
    }

    /**
     * Setup desktop context menu handler
     */
    setupDesktopContextMenu() {
        this.desktop.addEventListener('contextmenu', (e) => {
            // Only show context menu if clicking on desktop background
            if (e.target === this.desktop || e.target === this.windowsContainer) {
                e.preventDefault();
                this.contextMenu.open(e.clientX, e.clientY);
            }
        });
    }

    setupEditorContextMenu() {
        const textarea = document.getElementById('markdown-editor');
        if (!textarea) return;

        this.editorContextMenu = new RetroContextMenu({
            items: [
                { label: 'Undo', icon: '↩️', onClick: () => document.execCommand('undo') },
                { label: 'Redo', icon: '↪️', onClick: () => document.execCommand('redo') },
                { separator: true },
                { label: 'Cut', icon: '✂️', onClick: () => document.execCommand('cut') },
                { label: 'Copy', icon: '📋', onClick: () => document.execCommand('copy') },
                { label: 'Paste', icon: '📄', onClick: () => window.markdownPDFApp?.editor?.pasteFromClipboard() },
                { separator: true },
                {
                    label: 'Insert Image',
                    icon: '🖼️',
                    onClick: () => this.content.openImagesWindow(this.editorContextMenuPosition)
                }
            ],
            onClose: () => {}
        });
        this.editorContextMenu.mount(this.container);

        textarea.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            this.editorContextMenuPosition = textarea.selectionStart;
            this.editorContextMenu.open(e.clientX, e.clientY);
        });
    }

    /**
     * Initialize desktop icons
     */
    initDesktopIcons() {
        const icons = [
            { id: 'editor', label: 'Editor', icon: '📝', onDoubleClick: () => this.content.openMainWindow() },
            { id: 'images', label: 'Images', icon: '📷', onDoubleClick: () => this.content.openImagesWindow() },
            { id: 'settings', label: 'Settings', icon: '⚙️', onDoubleClick: () => this.content.openSettingsWindow() },
            { id: 'retro-effects', label: 'Retro Effects', icon: '🖥️', onDoubleClick: () => this.content.openRetroEffectsWindow() },
            { id: 'manual', label: 'Manual', icon: '📖', onDoubleClick: () => this.content.showManual() },
            { id: 'demo-md', label: 'demo.md', icon: '🗒️', onDoubleClick: () => this.content.openDemoMarkdown() },
            { id: 'demo-pdf', label: 'demo.pdf', icon: '📕', onDoubleClick: () => this.content.openDemoPDF() }
        ];

        const container = document.getElementById('desktop-icons');

        icons.forEach(iconConfig => {
            const icon = new RetroDesktopIcon({
                label: iconConfig.label,
                icon: iconConfig.icon,
                onDoubleClick: iconConfig.onDoubleClick,
                onClick: () => this.selectDesktopIcon(iconConfig.id)
            });

            icon.mount(container);
            this.desktopIcons.set(iconConfig.id, icon);
        });
    }

    /**
     * Select a single desktop icon, deselecting all others
     */
    selectDesktopIcon(iconId) {
        this.desktopIcons.forEach((icon, id) => {
            if (id === iconId) {
                icon.select();
            } else {
                icon.deselect();
            }
        });
    }

    /**
     * Deselect all desktop icons
     */
    deselectAllIcons() {
        this.desktopIcons.forEach(icon => icon.deselect());
    }

    /**
     * Setup desktop click handler to clear icon selection on background click
     */
    setupDesktopClickHandler() {
        this.desktop.addEventListener('click', (e) => {
            if (e.target === this.desktop || e.target === this.windowsContainer) {
                this.deselectAllIcons();
            }
        });
    }

    /**
     * Arrange desktop icons (placeholder)
     */
    arrangeIcons() {
        // Future enhancement: auto-arrange icons in grid
    }

    /**
     * Refresh desktop
     */
    refreshDesktop() {
        // Refresh desktop - could reload icons, clear selections, etc.
    }

    /**
     * Show desktop properties (placeholder)
     */
    showDesktopProperties() {
        retroDialog.alert(
            'Retro Desktop Environment\nResolution: ' + window.innerWidth + ' x ' + window.innerHeight,
            'Desktop Properties'
        );
    }

    /**
     * Close a window
     * @param {string} windowId - Window identifier
     */
    closeWindow(windowId) {
        const window = this.windows.get(windowId);
        if (window) {
            window.destroy();
            this.windows.delete(windowId);
            this.state.unregisterWindow(windowId);
            this.updateTaskbar();
        }
    }

    /**
     * Minimize a window
     * @param {string} windowId - Window identifier
     */
    minimizeWindow(windowId) {
        const window = this.windows.get(windowId);
        if (window) {
            window.hide();
            this.state.minimizeWindow(windowId);
            this.updateTaskbar();
        }
    }

    /**
     * Maximize/restore a window
     * @param {string} windowId - Window identifier
     */
    maximizeWindow(windowId) {
        const window = this.windows.get(windowId);
        if (window) {
            // Toggle maximized state
            window.toggleMaximized();
        }
    }

    /**
     * Focus a window
     * @param {string} windowId - Window identifier
     */
    focusWindow(windowId) {
        this.state.setActiveWindow(windowId);
        this.updateTaskbar();
    }

    /**
     * Handle taskbar button click
     * @param {string} windowId - Window identifier
     */
    handleTaskbarClick(windowId) {
        const isMinimized = this.state.isMinimized(windowId);
        const isActive = this.state.isActive(windowId);
        
        if (isMinimized) {
            // Restore window
            const window = this.windows.get(windowId);
            if (window) {
                window.show();
                this.state.restoreWindow(windowId);
                this.updateTaskbar();
            }
        } else if (isActive) {
            // Minimize if already active
            this.minimizeWindow(windowId);
        } else {
            // Bring to front
            this.focusWindow(windowId);
        }
    }

    /**
     * Toggle start menu
     */
    toggleStartMenu() {
        if (this.startMenu.isOpen()) {
            this.startMenu.close();
        } else {
            this.startMenu.open();
        }
    }

    /**
     * Close start menu
     */
    closeStartMenu() {
        this.startMenu.close();
    }

    /**
     * Update taskbar with current windows
     */
    updateTaskbar() {
        const openWindows = this.state.getOpenWindows();
        const items = openWindows.map(window => ({
            id: window.id,
            title: window.title,
            icon: window.icon,
            active: this.state.isActive(window.id) && !this.state.isMinimized(window.id),
            minimized: this.state.isMinimized(window.id),
            onClick: (windowId) => this.handleTaskbarClick(windowId)
        }));
        
        this.taskbar.updateTasks(items);
    }

    /**
     * Handle state changes
     * @param {Object} state - New state
     */
    handleStateChange(state) {
        // Update z-indexes for all windows
        state.openWindows.forEach((windowConfig, windowId) => {
            const window = this.windows.get(windowId);
            if (window) {
                window.setZIndex(windowConfig.zIndex);
                window.setActive(state.activeWindowId === windowId);
            }
        });
    }

    /**
     * Destroy the layout and clean up
     */
    destroy() {
        // Destroy all windows
        this.windows.forEach(window => window.destroy());
        this.windows.clear();
        
        // Destroy desktop icons
        this.desktopIcons.forEach(icon => icon.destroy());
        this.desktopIcons.clear();
        
        // Destroy taskbar, start menu, and context menus
        if (this.taskbar) this.taskbar.destroy();
        if (this.startMenu) this.startMenu.destroy();
        if (this.contextMenu) this.contextMenu.destroy();
        if (this.editorContextMenu) this.editorContextMenu.destroy();
        
        // Remove layout
        if (this.container) {
            this.container.remove();
        }
        
        // Remove retro mode class
        document.body.classList.remove('retro-mode');
        
        // Show original app container
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.style.display = 'flex';
        }
    }
}
