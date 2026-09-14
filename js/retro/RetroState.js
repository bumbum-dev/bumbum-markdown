/**
 * RetroState - State Management
 * Manages application state for retro desktop environment
 */

import * as Storage from '../modules/Storage.js';

export class RetroState {
    constructor() {
        this.state = {
            openWindows: new Map(), // windowId -> window config
            activeWindowId: null,
            minimizedWindows: new Set(),
            desktopIconPositions: new Map(),
            settings: {
                scanlinesEnabled: false,
                crtEffectEnabled: false,
                soundsEnabled: false,
                volume: 0.5
            }
        };
        
        this.listeners = new Set();
        this.loadState();
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        const parsed = Storage.getItem('retro-state');
        if (parsed) {
            // Restore settings
            if (parsed.settings) {
                this.state.settings = { ...this.state.settings, ...parsed.settings };
            }

            // Restore desktop icon positions
            if (parsed.desktopIconPositions) {
                this.state.desktopIconPositions = new Map(parsed.desktopIconPositions);
            }
        }
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        const toSave = {
            settings: this.state.settings,
            desktopIconPositions: Array.from(this.state.desktopIconPositions.entries())
        };
        Storage.setItem('retro-state', toSave);
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of state change
     */
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    /**
     * Register a window
     * @param {string} windowId - Unique window identifier
     * @param {Object} config - Window configuration
     */
    registerWindow(windowId, config) {
        this.state.openWindows.set(windowId, {
            id: windowId,
            ...config,
            zIndex: this.getNextZIndex()
        });
        this.notify();
    }

    /**
     * Unregister a window
     * @param {string} windowId - Window identifier
     */
    unregisterWindow(windowId) {
        this.state.openWindows.delete(windowId);
        this.state.minimizedWindows.delete(windowId);
        if (this.state.activeWindowId === windowId) {
            this.state.activeWindowId = null;
        }
        this.notify();
    }

    /**
     * Set active window
     * @param {string} windowId - Window identifier
     */
    setActiveWindow(windowId) {
        if (this.state.openWindows.has(windowId)) {
            this.state.activeWindowId = windowId;
            
            // Update z-index to bring to front
            const window = this.state.openWindows.get(windowId);
            window.zIndex = this.getNextZIndex();
            
            // Remove from minimized if it was minimized
            this.state.minimizedWindows.delete(windowId);
            
            this.notify();
        }
    }

    /**
     * Get next available z-index
     * @returns {number}
     */
    getNextZIndex() {
        let maxZ = 100;
        this.state.openWindows.forEach(window => {
            if (window.zIndex > maxZ) {
                maxZ = window.zIndex;
            }
        });
        return maxZ + 1;
    }

    /**
     * Minimize window
     * @param {string} windowId - Window identifier
     */
    minimizeWindow(windowId) {
        if (this.state.openWindows.has(windowId)) {
            this.state.minimizedWindows.add(windowId);
            if (this.state.activeWindowId === windowId) {
                this.state.activeWindowId = null;
            }
            this.notify();
        }
    }

    /**
     * Restore window from minimized state
     * @param {string} windowId - Window identifier
     */
    restoreWindow(windowId) {
        if (this.state.openWindows.has(windowId)) {
            this.state.minimizedWindows.delete(windowId);
            this.setActiveWindow(windowId);
        }
    }

    /**
     * Check if window is minimized
     * @param {string} windowId - Window identifier
     * @returns {boolean}
     */
    isMinimized(windowId) {
        return this.state.minimizedWindows.has(windowId);
    }

    /**
     * Check if window is active
     * @param {string} windowId - Window identifier
     * @returns {boolean}
     */
    isActive(windowId) {
        return this.state.activeWindowId === windowId;
    }

    /**
     * Get all open windows
     * @returns {Array}
     */
    getOpenWindows() {
        return Array.from(this.state.openWindows.values());
    }

    /**
     * Update window position
     * @param {string} windowId - Window identifier
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    updateWindowPosition(windowId, x, y) {
        const window = this.state.openWindows.get(windowId);
        if (window) {
            window.x = x;
            window.y = y;
            this.notify();
        }
    }

    /**
     * Update desktop icon position
     * @param {string} iconId - Icon identifier
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    updateIconPosition(iconId, x, y) {
        this.state.desktopIconPositions.set(iconId, { x, y });
        this.saveState();
    }

    /**
     * Get icon position
     * @param {string} iconId - Icon identifier
     * @returns {Object|null}
     */
    getIconPosition(iconId) {
        return this.state.desktopIconPositions.get(iconId) || null;
    }

    /**
     * Update settings
     * @param {Object} newSettings - New settings to merge
     */
    updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };
        this.saveState();
        this.notify();
    }

    /**
     * Get current settings
     * @returns {Object}
     */
    getSettings() {
        return { ...this.state.settings };
    }

    /**
     * Reset settings to defaults
     */
    resetSettings() {
        this.state.settings = {
            scanlinesEnabled: false,
            crtEffectEnabled: false,
            soundsEnabled: false,
            volume: 0.5
        };
        this.saveState();
        this.notify();
    }

    /**
     * Clear all state
     */
    clear() {
        this.state.openWindows.clear();
        this.state.minimizedWindows.clear();
        this.state.activeWindowId = null;
        this.notify();
    }
}
