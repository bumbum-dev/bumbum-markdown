/**
 * ThemeManager Module
 * Handles theme switching and management
 */

import { THEMES, isValidTheme } from './themeRegistry.js';
import { CODE_THEMES, isValidCodeTheme } from './codeThemeRegistry.js';
import * as Storage from './Storage.js';

export class ThemeManager {
    constructor(mermaidRenderer) {
        this.mermaidRenderer = mermaidRenderer;
        this.currentTheme = 'modern';
        this.currentCodeTheme = 'default';
        this.themeSelector = null;
        this.themeStylesheet = null;
        this.codeThemeSelector = null;
        this.codeThemeStylesheet = null;
        this.previewContainer = null;
        this.customStyleElement = null;
        this.customCSS = '';

        this.init();
    }

    /**
     * Populate a <select>'s options from a theme registry list, replacing
     * whatever's already in it
     * @param {HTMLSelectElement} selectEl
     * @param {Array<{name: string, displayName: string}>} themeList
     */
    populateThemeOptions(selectEl, themeList) {
        selectEl.innerHTML = themeList
            .map(theme => `<option value="${theme.name}">${theme.displayName}</option>`)
            .join('');
    }

    /**
     * Initialize theme manager
     */
    init() {
        // Get DOM elements
        this.themeSelector = document.getElementById('theme-selector');
        this.themeStylesheet = document.getElementById('theme-stylesheet');
        this.codeThemeSelector = document.getElementById('code-theme-selector');
        this.codeThemeStylesheet = document.getElementById('code-theme-stylesheet');
        this.previewContainer = document.getElementById('preview-content');

        if (!this.themeSelector || !this.themeStylesheet) {
            console.error('Theme elements not found');
            return;
        }

        this.populateThemeOptions(this.themeSelector, THEMES);
        if (this.codeThemeSelector) {
            this.populateThemeOptions(this.codeThemeSelector, CODE_THEMES);
        }

        // Create custom style element for custom CSS
        this.customStyleElement = document.createElement('style');
        this.customStyleElement.id = 'custom-theme-css';
        document.head.appendChild(this.customStyleElement);

        // Set up event listeners
        this.themeSelector.addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });
        this.codeThemeSelector?.addEventListener('change', (e) => {
            this.changeCodeTheme(e.target.value);
        });

        // Load saved theme(s) and custom CSS from localStorage
        this.loadSavedTheme();
        this.loadSavedCodeTheme();
        this.loadCustomCSS();
    }

    /**
     * Change the current theme
     * @param {string} themeName - Name of the theme to apply
     */
    async changeTheme(themeName) {
        if (!isValidTheme(themeName)) {
            console.error('Invalid theme name:', themeName);
            return;
        }

        // Update stylesheet href
        this.themeStylesheet.href = `css/themes/${themeName}.css`;

        Array.from(document.body.classList).forEach(cls => {
            if (cls.startsWith('theme-')) {
                document.body.classList.remove(cls);
            }
        });
        document.body.classList.add(`theme-${themeName}`);

        // Update current theme
        this.currentTheme = themeName;

        // Update theme selector value
        this.themeSelector.value = themeName;

        // Save to localStorage
        this.saveTheme(themeName);

        // Update Mermaid theme
        if (this.mermaidRenderer) {
            this.mermaidRenderer.updateTheme(themeName);
            
            // Re-render diagrams with new theme
            if (this.previewContainer) {
                await this.mermaidRenderer.reRenderAll(this.previewContainer);
            }
        }
    }

    /**
     * Save theme preference to localStorage
     * @param {string} themeName - Theme name to save
     */
    saveTheme(themeName) {
        Storage.setItem('markdown-pdf-theme', themeName);
    }

    /**
     * Load saved theme from localStorage
     */
    loadSavedTheme() {
        const savedTheme = Storage.getItem('markdown-pdf-theme');

        if (savedTheme && isValidTheme(savedTheme)) {
            this.changeTheme(savedTheme);
        }
    }

    /**
     * Get current theme name
     * @returns {string} Current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Change the current code block theme
     * @param {string} codeThemeName - Name of the code theme to apply
     */
    changeCodeTheme(codeThemeName) {
        if (!isValidCodeTheme(codeThemeName)) {
            console.error('Invalid code theme name:', codeThemeName);
            return;
        }

        if (this.codeThemeStylesheet) {
            const codeTheme = CODE_THEMES.find(theme => theme.name === codeThemeName);
            this.codeThemeStylesheet.href = codeTheme?.hljsUrl || '';
        }

        Array.from(document.body.classList).forEach(cls => {
            if (cls.startsWith('code-theme-')) {
                document.body.classList.remove(cls);
            }
        });
        if (codeThemeName !== 'default') {
            document.body.classList.add(`code-theme-${codeThemeName}`);
        }

        this.currentCodeTheme = codeThemeName;

        if (this.codeThemeSelector) {
            this.codeThemeSelector.value = codeThemeName;
        }

        this.saveCodeTheme(codeThemeName);
    }

    /**
     * Save code theme preference to localStorage
     * @param {string} codeThemeName - Code theme name to save
     */
    saveCodeTheme(codeThemeName) {
        Storage.setItem('markdown-pdf-code-theme', codeThemeName);
    }

    /**
     * Load saved code theme from localStorage
     */
    loadSavedCodeTheme() {
        const savedCodeTheme = Storage.getItem('markdown-pdf-code-theme');

        if (savedCodeTheme && isValidCodeTheme(savedCodeTheme)) {
            this.changeCodeTheme(savedCodeTheme);
        }
    }

    /**
     * Get current code theme name
     * @returns {string} Current code theme name
     */
    getCurrentCodeTheme() {
        return this.currentCodeTheme;
    }

    /**
     * Set custom CSS
     * @param {string} css - Custom CSS to apply
     */
    setCustomCSS(css) {
        this.customCSS = css;
        
        if (this.customStyleElement) {
            this.customStyleElement.textContent = css;
        }
        
        // Save to localStorage
        this.saveCustomCSS(css);
    }

    /**
     * Get current custom CSS
     * @returns {string} Current custom CSS
     */
    getCustomCSS() {
        return this.customCSS;
    }

    /**
     * Save custom CSS to localStorage
     * @param {string} css - CSS to save
     */
    saveCustomCSS(css) {
        Storage.setItem('markdown-pdf-custom-css', css);
    }

    /**
     * Load custom CSS from localStorage
     */
    loadCustomCSS() {
        const savedCSS = Storage.getItem('markdown-pdf-custom-css');
        if (savedCSS) {
            this.setCustomCSS(savedCSS);
        }
    }

    /**
     * Clear custom CSS
     */
    clearCustomCSS() {
        this.setCustomCSS('');
    }
}
