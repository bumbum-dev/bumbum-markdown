/**
 * Settings Manager
 * Handles PDF customization settings and UI
 */

import retroDialog from '../retro/RetroDialog.js';
import * as Storage from './Storage.js';

export class SettingsManager {
    constructor(pdfService) {
        this.pdfService = pdfService;
        this.settings = this.getDefaultSettings();
        this.isOpen = false;
        
        this.init();
    }

    /**
     * Get default settings
     * @returns {Object} Default PDF settings
     */
    getDefaultSettings() {
        return {
            margins: {
                top: 20,
                bottom: 20,
                left: 20,
                right: 20
            },
            pageSize: 'A4',
            fontSize: 12,
            fontFamily: "Arial, 'Liberation Sans', 'Helvetica Neue', Helvetica, sans-serif",
            lineHeight: 1.5,
            // Future settings
            headers: {
                enabled: false,
                template: ''
            },
            footers: {
                enabled: false,
                template: '',
                pageNumbers: true
            },
            metadata: {
                title: '',
                author: '',
                subject: '',
                keywords: ''
            },
            coverPage: {
                enabled: false,
                title: '',
                subtitle: '',
                author: '',
                date: ''
            },
            toc: {
                enabled: false,
                depth: 3,
                title: 'Table of Contents'
            },
            // Auto-populate date
            currentDate: new Date().toISOString().split('T')[0]
        };
    }

    /**
     * Initialize settings manager
     */
    init() {
        // Load saved settings from localStorage
        this.loadSettings();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.updateUI();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Settings toggle button
        const toggleBtn = document.getElementById('settings-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.togglePanel());
        }

        // Close button
        const closeBtn = document.getElementById('settings-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
        }

        // Margin controls
        ['top', 'bottom', 'left', 'right'].forEach(side => {
            const slider = document.getElementById(`margin-${side}`);
            const input = document.getElementById(`margin-${side}-value`);
            
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.settings.margins[side] = value;
                    if (input) input.value = value;
                    this.saveSettings();
                });
            }
            
            if (input) {
                input.addEventListener('change', (e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 0 && value <= 50) {
                        this.settings.margins[side] = value;
                        if (slider) slider.value = value;
                        this.saveSettings();
                    }
                });
            }
        });

        // Page size
        const pageSize = document.getElementById('page-size');
        if (pageSize) {
            pageSize.addEventListener('change', (e) => {
                this.settings.pageSize = e.target.value;
                this.saveSettings();
            });
        }

        // Font family
        const fontFamily = document.getElementById('font-family');
        if (fontFamily) {
            fontFamily.addEventListener('change', (e) => {
                this.settings.fontFamily = e.target.value;
                this.saveSettings();
                this.updatePreviewFont();
            });
        }

        // Font size
        const fontSize = document.getElementById('font-size');
        const fontSizeValue = document.getElementById('font-size-value');
        if (fontSize) {
            fontSize.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.settings.fontSize = value;
                if (fontSizeValue) fontSizeValue.textContent = value;
                this.saveSettings();
                this.updatePreviewFont();
            });
        }

        // Line height
        const lineHeight = document.getElementById('line-height');
        const lineHeightValue = document.getElementById('line-height-value');
        if (lineHeight) {
            lineHeight.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.settings.lineHeight = value;
                if (lineHeightValue) lineHeightValue.textContent = value.toFixed(1);
                this.saveSettings();
                this.updatePreviewFont();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('settings-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }

        // Export settings
        const exportBtn = document.getElementById('settings-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSettings());
        }

        // Import settings
        const importBtn = document.getElementById('settings-import');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importSettings());
        }

        // TOC settings
        const tocEnabled = document.getElementById('toc-enabled');
        if (tocEnabled) {
            tocEnabled.addEventListener('change', (e) => {
                this.settings.toc.enabled = e.target.checked;
                this.toggleTOCOptions(e.target.checked);
                this.saveSettings();
            });
        }

        const tocDepth = document.getElementById('toc-depth');
        if (tocDepth) {
            tocDepth.addEventListener('change', (e) => {
                this.settings.toc.depth = parseInt(e.target.value);
                this.saveSettings();
            });
        }

        const tocTitle = document.getElementById('toc-title');
        if (tocTitle) {
            tocTitle.addEventListener('input', (e) => {
                this.settings.toc.title = e.target.value;
                this.saveSettings();
            });
        }

        // Header settings
        const headerEnabled = document.getElementById('header-enabled');
        if (headerEnabled) {
            headerEnabled.addEventListener('change', (e) => {
                this.settings.headers.enabled = e.target.checked;
                this.toggleHeaderOptions(e.target.checked);
                this.saveSettings();
            });
        }

        const headerTemplate = document.getElementById('header-template');
        if (headerTemplate) {
            headerTemplate.addEventListener('input', (e) => {
                this.settings.headers.template = e.target.value;
                this.saveSettings();
            });
        }

        // Footer settings
        const footerEnabled = document.getElementById('footer-enabled');
        if (footerEnabled) {
            footerEnabled.addEventListener('change', (e) => {
                this.settings.footers.enabled = e.target.checked;
                this.toggleFooterOptions(e.target.checked);
                this.saveSettings();
            });
        }

        const footerPageNumbers = document.getElementById('footer-page-numbers');
        if (footerPageNumbers) {
            footerPageNumbers.addEventListener('change', (e) => {
                this.settings.footers.pageNumbers = e.target.checked;
                this.saveSettings();
            });
        }

        const footerTemplate = document.getElementById('footer-template');
        if (footerTemplate) {
            footerTemplate.addEventListener('input', (e) => {
                this.settings.footers.template = e.target.value;
                this.saveSettings();
            });
        }

        // Metadata settings
        const docTitle = document.getElementById('doc-title');
        if (docTitle) {
            docTitle.addEventListener('input', (e) => {
                this.settings.metadata.title = e.target.value;
                this.saveSettings();
            });
        }

        const docAuthor = document.getElementById('doc-author');
        if (docAuthor) {
            docAuthor.addEventListener('input', (e) => {
                this.settings.metadata.author = e.target.value;
                this.saveSettings();
            });
        }

        const docSubject = document.getElementById('doc-subject');
        if (docSubject) {
            docSubject.addEventListener('input', (e) => {
                this.settings.metadata.subject = e.target.value;
                this.saveSettings();
            });
        }

        const docKeywords = document.getElementById('doc-keywords');
        if (docKeywords) {
            docKeywords.addEventListener('input', (e) => {
                this.settings.metadata.keywords = e.target.value;
                this.saveSettings();
            });
        }

        // Cover page settings
        const coverEnabled = document.getElementById('cover-enabled');
        if (coverEnabled) {
            coverEnabled.addEventListener('change', (e) => {
                this.settings.coverPage.enabled = e.target.checked;
                this.toggleCoverOptions(e.target.checked);
                this.saveSettings();
            });
        }

        const coverTitle = document.getElementById('cover-title');
        if (coverTitle) {
            coverTitle.addEventListener('input', (e) => {
                this.settings.coverPage.title = e.target.value;
                this.saveSettings();
            });
        }

        const coverSubtitle = document.getElementById('cover-subtitle');
        if (coverSubtitle) {
            coverSubtitle.addEventListener('input', (e) => {
                this.settings.coverPage.subtitle = e.target.value;
                this.saveSettings();
            });
        }

        const coverAuthor = document.getElementById('cover-author');
        if (coverAuthor) {
            coverAuthor.addEventListener('input', (e) => {
                this.settings.coverPage.author = e.target.value;
                this.saveSettings();
            });
        }

        const coverDate = document.getElementById('cover-date');
        if (coverDate) {
            coverDate.addEventListener('change', (e) => {
                this.settings.coverPage.date = e.target.value;
                this.saveSettings();
            });
        }
    }

    /**
     * Toggle settings panel
     */
    togglePanel() {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('settings-panel');
        const overlay = document.getElementById('settings-overlay');
        
        if (panel) {
            panel.classList.toggle('open', this.isOpen);
        }
        if (overlay) {
            overlay.classList.toggle('visible', this.isOpen);
        }
    }

    /**
     * Open settings panel
     */
    openPanel() {
        this.isOpen = true;
        const panel = document.getElementById('settings-panel');
        const overlay = document.getElementById('settings-overlay');
        
        if (panel) panel.classList.add('open');
        if (overlay) overlay.classList.add('visible');
    }

    /**
     * Close settings panel
     */
    closePanel() {
        this.isOpen = false;
        const panel = document.getElementById('settings-panel');
        const overlay = document.getElementById('settings-overlay');
        
        if (panel) panel.classList.remove('open');
        if (overlay) overlay.classList.remove('visible');
    }

    /**
     * Update UI with current settings
     */
    updateUI() {
        // Update margin controls
        ['top', 'bottom', 'left', 'right'].forEach(side => {
            const slider = document.getElementById(`margin-${side}`);
            const input = document.getElementById(`margin-${side}-value`);
            const value = this.settings.margins[side];
            
            if (slider) slider.value = value;
            if (input) input.value = value;
        });

        // Update page size
        const pageSize = document.getElementById('page-size');
        if (pageSize) pageSize.value = this.settings.pageSize;

        // Update font family
        const fontFamily = document.getElementById('font-family');
        if (fontFamily) fontFamily.value = this.settings.fontFamily;

        // Update font size
        const fontSize = document.getElementById('font-size');
        const fontSizeValue = document.getElementById('font-size-value');
        if (fontSize) fontSize.value = this.settings.fontSize;
        if (fontSizeValue) fontSizeValue.textContent = this.settings.fontSize;

        // Update line height
        const lineHeight = document.getElementById('line-height');
        const lineHeightValue = document.getElementById('line-height-value');
        if (lineHeight) lineHeight.value = this.settings.lineHeight;
        if (lineHeightValue) lineHeightValue.textContent = this.settings.lineHeight.toFixed(1);

        // Update preview font
        this.updatePreviewFont();

        // Update document structure UI
        this.updateDocumentStructureUI();
    }

    /**
     * Update preview panel font settings
     */
    updatePreviewFont() {
        const preview = document.getElementById('preview-content');
        if (preview) {
            preview.style.fontFamily = this.settings.fontFamily;
            preview.style.fontSize = `${this.settings.fontSize}pt`;
            preview.style.lineHeight = this.settings.lineHeight;
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        Storage.setItem('pdf-settings', this.settings);

        // Dispatch event to notify listeners that settings changed
        const event = new CustomEvent('settingsChanged', {
            detail: { settings: this.settings }
        });
        document.dispatchEvent(event);
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const saved = Storage.getItem('pdf-settings');
        if (saved) {
            // Merge with defaults to ensure all properties exist
            this.settings = { ...this.getDefaultSettings(), ...saved };
            this.settings.fontFamily = this.normalizeFontFamily(this.settings.fontFamily);
        } else {
            this.settings = this.getDefaultSettings();
        }
    }

    /**
     * Resolve a possibly-stale fontFamily value to one that actually
     * matches a current #font-family <option> (index.html), so the
     * dropdown doesn't render blank.
     * @param {string} value - Stored/candidate fontFamily value
     * @returns {string} A value matching a current #font-family <option>
     */
    normalizeFontFamily(value) {
        const select = document.getElementById('font-family');
        if (!select) return value;

        const options = Array.from(select.options).map(opt => opt.value);
        if (options.includes(value)) {
            return value;
        }

        const leadingName = (value || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
        const match = options.find(opt =>
            opt.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase() === leadingName
        );

        return match || this.getDefaultSettings().fontFamily;
    }

    /**
     * Reset settings to defaults
     */
    async resetSettings() {
        if (await retroDialog.confirm('Reset all settings to defaults?', 'Reset Settings')) {
            this.settings = this.getDefaultSettings();
            this.saveSettings();
            this.updateUI();
            
            // Show notification
            if (window.markdownPDFApp) {
                window.markdownPDFApp.showNotification('Settings reset to defaults', 'info');
            }
        }
    }

    /**
     * Export settings as JSON file
     */
    exportSettings() {
        const data = JSON.stringify(this.settings, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pdf-settings.json';
        a.click();
        
        URL.revokeObjectURL(url);
        
        if (window.markdownPDFApp) {
            window.markdownPDFApp.showNotification('Settings exported', 'success');
        }
    }

    /**
     * Import settings from JSON file
     */
    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    this.settings = { ...this.getDefaultSettings(), ...imported };
                    this.settings.fontFamily = this.normalizeFontFamily(this.settings.fontFamily);
                    this.saveSettings();
                    this.updateUI();
                    
                    if (window.markdownPDFApp) {
                        window.markdownPDFApp.showNotification('Settings imported successfully', 'success');
                    }
                } catch (error) {
                    console.error('Failed to import settings:', error);
                    if (window.markdownPDFApp) {
                        window.markdownPDFApp.showNotification('Failed to import settings', 'error');
                    }
                }
            };
            reader.readAsText(file);
        });
        
        input.click();
    }

    /**
     * Get current settings for PDF generation
     * @returns {Object} Current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Update a specific setting
     * @param {string} path - Setting path (e.g., 'margins.top')
     * @param {*} value - New value
     */
    updateSetting(path, value) {
        const keys = path.split('.');
        let current = this.settings;
        
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveSettings();
    }

    /**
     * Update document structure UI elements
     */
    updateDocumentStructureUI() {
        // TOC
        const tocEnabled = document.getElementById('toc-enabled');
        if (tocEnabled) {
            tocEnabled.checked = this.settings.toc.enabled;
            this.toggleTOCOptions(this.settings.toc.enabled);
        }

        const tocDepth = document.getElementById('toc-depth');
        if (tocDepth) tocDepth.value = this.settings.toc.depth;

        const tocTitle = document.getElementById('toc-title');
        if (tocTitle) tocTitle.value = this.settings.toc.title;

        // Headers
        const headerEnabled = document.getElementById('header-enabled');
        if (headerEnabled) {
            headerEnabled.checked = this.settings.headers.enabled;
            this.toggleHeaderOptions(this.settings.headers.enabled);
        }

        const headerTemplate = document.getElementById('header-template');
        if (headerTemplate) headerTemplate.value = this.settings.headers.template;

        // Footers
        const footerEnabled = document.getElementById('footer-enabled');
        if (footerEnabled) {
            footerEnabled.checked = this.settings.footers.enabled;
            this.toggleFooterOptions(this.settings.footers.enabled);
        }

        const footerPageNumbers = document.getElementById('footer-page-numbers');
        if (footerPageNumbers) footerPageNumbers.checked = this.settings.footers.pageNumbers;

        const footerTemplate = document.getElementById('footer-template');
        if (footerTemplate) footerTemplate.value = this.settings.footers.template;

        // Metadata
        const docTitle = document.getElementById('doc-title');
        if (docTitle) docTitle.value = this.settings.metadata.title;

        const docAuthor = document.getElementById('doc-author');
        if (docAuthor) docAuthor.value = this.settings.metadata.author;

        const docSubject = document.getElementById('doc-subject');
        if (docSubject) docSubject.value = this.settings.metadata.subject;

        const docKeywords = document.getElementById('doc-keywords');
        if (docKeywords) docKeywords.value = this.settings.metadata.keywords;

        // Cover page
        const coverEnabled = document.getElementById('cover-enabled');
        if (coverEnabled) {
            coverEnabled.checked = this.settings.coverPage.enabled;
            this.toggleCoverOptions(this.settings.coverPage.enabled);
        }

        const coverTitle = document.getElementById('cover-title');
        if (coverTitle) coverTitle.value = this.settings.coverPage.title;

        const coverSubtitle = document.getElementById('cover-subtitle');
        if (coverSubtitle) coverSubtitle.value = this.settings.coverPage.subtitle;

        const coverAuthor = document.getElementById('cover-author');
        if (coverAuthor) coverAuthor.value = this.settings.coverPage.author;

        const coverDate = document.getElementById('cover-date');
        if (coverDate) {
            coverDate.value = this.settings.coverPage.date || this.settings.currentDate;
        }
    }

    /**
     * Toggle TOC options visibility
     */
    toggleTOCOptions(enabled) {
        const tocOptions = document.getElementById('toc-options');
        const tocTitleGroup = document.getElementById('toc-title-group');
        
        if (tocOptions) {
            tocOptions.style.display = enabled ? 'block' : 'none';
        }
        if (tocTitleGroup) {
            tocTitleGroup.style.display = enabled ? 'block' : 'none';
        }
    }

    /**
     * Toggle header options visibility
     */
    toggleHeaderOptions(enabled) {
        const headerTemplateGroup = document.getElementById('header-template-group');
        if (headerTemplateGroup) {
            headerTemplateGroup.style.display = enabled ? 'block' : 'none';
        }
    }

    /**
     * Toggle footer options visibility
     */
    toggleFooterOptions(enabled) {
        const footerOptions = document.getElementById('footer-options');
        const footerTemplateGroup = document.getElementById('footer-template-group');
        
        if (footerOptions) {
            footerOptions.style.display = enabled ? 'block' : 'none';
        }
        if (footerTemplateGroup) {
            footerTemplateGroup.style.display = enabled ? 'block' : 'none';
        }
    }

    /**
     * Toggle cover page options visibility
     */
    toggleCoverOptions(enabled) {
        const coverOptions = document.getElementById('cover-options');
        if (coverOptions) {
            coverOptions.style.display = enabled ? 'block' : 'none';
        }
    }
}
