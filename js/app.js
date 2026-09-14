/**
 * Main Application Entry Point
 */

import { Renderer } from './modules/Renderer.js';
import { MermaidRenderer } from './modules/MermaidRenderer.js';
import { MathRenderer } from './modules/MathRenderer.js';
import { Editor } from './modules/Editor.js';
import { PDFService } from './modules/PDFService.js';
import { ThemeManager } from './modules/ThemeManager.js';
import { SettingsManager } from './modules/SettingsManager.js';
import { DocumentStructure } from './modules/DocumentStructure.js';
import { ImageManager } from './modules/ImageManager.js';
import { ImagePanel } from './modules/ImagePanel.js';
import { TocPanel } from './modules/TocPanel.js';
import { FileManager } from './modules/FileManager.js';
import { LoadingManager } from './modules/LoadingManager.js';
import { ExportManager } from './modules/ExportManager.js';
import { PagedPreviewRenderer } from './modules/PagedPreviewRenderer.js';
import * as Storage from './modules/Storage.js';
import retroDialog from './retro/RetroDialog.js';
import { RetroLayout } from './retro/RetroLayout.js';

class App {
    constructor() {
        this.renderer = null;
        this.mermaidRenderer = null;
        this.mathRenderer = null;
        this.editor = null;
        this.pdfService = null;
        this.themeManager = null;
        this.settingsManager = null;
        this.documentStructure = null;
        this.imageManager = null;
        this.imagePanel = null;
        this.tocPanel = null;
        this.fileManager = null;
        this.loadingManager = null;
        this.exportManager = null;
        this.pagedPreviewRenderer = null;
        this.retroLayout = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        } catch (error) {
            console.error('Application initialization error:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    /**
     * Set up application components
     */
    setup() {
        // Check if required libraries are loaded (with timeout)
        if (!this.retryCount) this.retryCount = 0;
        
        if (typeof window.markdownit === 'undefined' && this.retryCount < 20) {
            this.retryCount++;
            setTimeout(() => this.setup(), 100);
            return;
        }
        if (typeof window.mermaid === 'undefined' && this.retryCount < 20) {
            this.retryCount++;
            setTimeout(() => this.setup(), 100);
            return;
        }
        if (typeof window.hljs === 'undefined' && this.retryCount < 20) {
            this.retryCount++;
            setTimeout(() => this.setup(), 100);
            return;
        }

        // Reset retry counter
        this.retryCount = 0;

        // Warn about missing libraries but continue
        if (typeof window.markdownit === 'undefined') {
            console.error('markdown-it failed to load - some features may not work');
        }
        if (typeof window.mermaid === 'undefined') {
            console.error('mermaid failed to load - diagrams will not render');
        }
        if (typeof window.hljs === 'undefined') {
            console.warn('highlight.js failed to load after retries - code highlighting disabled');
        }

        // Initialize loading manager
        this.loadingManager = new LoadingManager();
        
        // Initialize image management
        this.imageManager = new ImageManager();
        
        // Initialize core modules (pass imageManager to Renderer)
        this.renderer = new Renderer(this.imageManager);
        this.mermaidRenderer = new MermaidRenderer();
        this.mathRenderer = new MathRenderer();
        this.documentStructure = new DocumentStructure();
        this.pagedPreviewRenderer = new PagedPreviewRenderer(this.mermaidRenderer, this.documentStructure, this.mathRenderer);
        this.pdfService = new PDFService(this.pagedPreviewRenderer);

        this.themeManager = new ThemeManager(this.mermaidRenderer);
        this.settingsManager = new SettingsManager(this.pdfService);

        // Initialize editor (depends on renderer, mermaidRenderer, documentStructure, and settingsManager)
        this.editor = new Editor(this.renderer, this.mermaidRenderer, this.documentStructure, this.settingsManager, this.mathRenderer);

        // Sync the editor to the matching source line when the user clicks
        // an in-document anchor link inside the PDF preview, mirroring what
        // clicking a TOC side-panel entry already does (see TocPanel.js).
        this.pagedPreviewRenderer.onAnchorNavigate = (line) => this.editor.scrollToLineCentered(line);

        // Initialize image panel (depends on imageManager and editor)
        this.imagePanel = new ImagePanel(this.imageManager, this.editor);

        // Initialize TOC panel (depends on editor, renderer, documentStructure)
        this.tocPanel = new TocPanel(this.editor, this.renderer, this.documentStructure);

        // Initialize file manager (depends on editor)
        this.fileManager = new FileManager(this.editor);

        // Initialize export manager
        this.exportManager = new ExportManager(this.pdfService, this.renderer, this.settingsManager);

        // Expose components globally for cross-module access
        window.markdownPDFApp = window.markdownPDFApp || {};
        window.markdownPDFApp.pdfService = this.pdfService;
        window.markdownPDFApp.settingsManager = this.settingsManager;
        window.markdownPDFApp.fileManager = this.fileManager;
        window.markdownPDFApp.loadingManager = this.loadingManager;
        window.markdownPDFApp.exportManager = this.exportManager;
        window.markdownPDFApp.pagedPreviewRenderer = this.pagedPreviewRenderer;
        window.markdownPDFApp.showNotification = this.showNotification.bind(this);

        // Set up export functionality
        this.setupExportButtons();
        
        // Set up preview mode toggle button
        this.setupPreviewModeToggle();

        // Set up draggable splitter between editor and preview panels
        this.setupPanelSplitter();

        // Set up image panel toggle button
        this.setupImagePanelToggle();

        // Set up TOC panel toggle button
        this.setupTocPanelToggle();

        // Set up editor enhancement buttons
        this.setupEditorEnhancements();
        
        // Initialize scroll synchronization
        this.setupScrollSync();
        
        // Set up settings change listener
        this.setupSettingsListener();
        
        // Set up settings overlay click to close
        this.setupSettingsOverlay();
        
        // Set up custom CSS functionality
        this.setupCustomCSS();

        // Initialize retro layout (Windows 95 style)
        this.initRetroLayout();
    }

    /**
     * Set up export buttons and dropdown functionality
     */
    setupExportButtons() {
        const exportPdfBtn = document.getElementById('export-pdf');
        const dropdownToggle = document.getElementById('export-dropdown-toggle');
        const dropdownMenu = document.getElementById('export-dropdown-menu');
        const previewContent = document.getElementById('preview-content');

        if (!exportPdfBtn || !dropdownToggle || !dropdownMenu || !previewContent) {
            console.error('Export UI elements not found');
            return;
        }

        // Main export PDF button
        exportPdfBtn.addEventListener('click', async () => {
            await this.handleExportPDF();
        });

        // Dropdown toggle
        let isDropdownOpen = false;
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            isDropdownOpen = !isDropdownOpen;
            dropdownMenu.classList.toggle('active', isDropdownOpen);
            dropdownToggle.setAttribute('aria-expanded', isDropdownOpen.toString());
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (isDropdownOpen && !dropdownMenu.contains(e.target) && !dropdownToggle.contains(e.target)) {
                isDropdownOpen = false;
                dropdownMenu.classList.remove('active');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Dropdown menu items
        const dropdownItems = dropdownMenu.querySelectorAll('.export-dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                const action = item.getAttribute('data-action');
                
                // Close dropdown
                isDropdownOpen = false;
                dropdownMenu.classList.remove('active');
                dropdownToggle.setAttribute('aria-expanded', 'false');

                // Handle action
                await this.handleExportAction(action);
            });
        });

        // Keyboard navigation for dropdown
        dropdownToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropdownToggle.click();
            }
        });
    }

    /**
     * Handle export PDF action
     */
    async handleExportPDF() {
        try {
            const currentTheme = this.themeManager.getCurrentTheme();
            const currentCodeTheme = this.themeManager.getCurrentCodeTheme();
            const settings = this.settingsManager.getSettings();
            const markdown = this.editor.getContent();

            await this.loadingManager.withLoading(
                async () => {
                    await this.exportManager.exportAsPDF(markdown, currentTheme, settings, currentCodeTheme);
                },
                {
                    message: 'Preparing PDF...',
                    subtext: 'Opening the print dialog — choose "Save as PDF"'
                }
            );
        } catch (error) {
            console.error('PDF export error:', error);
            // Error notification already shown by ExportManager
        }
    }

    /**
     * Handle export action from dropdown
     * @param {string} action - Action identifier
     */
    async handleExportAction(action) {
        const previewContent = document.getElementById('preview-content');
        const currentTheme = this.themeManager.getCurrentTheme();
        const currentCodeTheme = this.themeManager.getCurrentCodeTheme();
        const settings = this.settingsManager.getSettings();
        const markdown = this.editor.getContent();

        try {
            switch (action) {
                case 'export-pdf':
                    await this.handleExportPDF();
                    break;

                case 'export-html':
                    await this.loadingManager.withLoading(
                        async () => {
                            await this.exportManager.exportAsHTML(markdown, currentTheme, currentCodeTheme);
                        },
                        {
                            message: 'Exporting HTML...',
                            subtext: 'Creating standalone HTML file'
                        }
                    );
                    break;

                case 'print-preview':
                    this.exportManager.openPrintPreview(previewContent, currentTheme, currentCodeTheme);
                    break;

                case 'batch-export':
                    await this.loadingManager.withLoading(
                        async () => {
                            await this.exportManager.batchExport(
                                markdown,
                                currentTheme,
                                settings,
                                ['pdf', 'html'],
                                currentCodeTheme
                            );
                        },
                        {
                            message: 'Batch Exporting...',
                            subtext: 'Generating multiple formats'
                        }
                    );
                    break;

                default:
                    console.warn('Unknown export action:', action);
            }
        } catch (error) {
            console.error('Export action error:', error);
            // Error notification already shown by ExportManager
        }
    }

    /**
     * Get document title from content or use default
     * @returns {string} Document title for filename
     */
    getDocumentTitle() {
        const previewContent = document.getElementById('preview-content');
        const firstHeading = previewContent.querySelector('h1');
        
        if (firstHeading && firstHeading.textContent.trim()) {
            // Clean up the title for use as filename
            return firstHeading.textContent
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 50) || 'document';
        }
        
        return 'document';
    }

    /**
     * Set up preview mode toggle buttons (Markdown Preview / PDF Preview)
     */
    setupPreviewModeToggle() {
        const markdownButton = document.getElementById('preview-mode-markdown');
        const pdfButton = document.getElementById('preview-mode-pdf');
        if (!markdownButton || !pdfButton) {
            console.error('Preview mode buttons not found');
            return;
        }

        this.updatePreviewModeButtons(markdownButton, pdfButton);

        markdownButton.addEventListener('click', () => {
            if (this.editor.getPreviewMode() === 'simple') return;
            this.editor.setPreviewMode('simple');
            this.updatePreviewModeButtons(markdownButton, pdfButton);
            this.showNotification('Switched to Markdown Preview', 'info');
        });

        pdfButton.addEventListener('click', () => {
            if (this.editor.getPreviewMode() === 'document') return;
            this.editor.setPreviewMode('document');
            this.updatePreviewModeButtons(markdownButton, pdfButton);
            this.showNotification('Switched to PDF Preview', 'info');
        });
    }

    /**
     * Highlight whichever preview mode button matches the editor's current mode
     * @param {HTMLElement} markdownButton
     * @param {HTMLElement} pdfButton
     */
    updatePreviewModeButtons(markdownButton, pdfButton) {
        const isDocument = this.editor.getPreviewMode() === 'document';

        markdownButton.classList.toggle('active', !isDocument);
        markdownButton.setAttribute('aria-pressed', String(!isDocument));

        pdfButton.classList.toggle('active', isDocument);
        pdfButton.setAttribute('aria-pressed', String(isDocument));
    }

    /**
     * Set up the draggable splitter between the editor and preview panels,
     * restoring and persisting the user's chosen ratio in localStorage
     * (same convention as Editor's `previewMode` key: a raw scalar string,
     * not routed through SettingsManager, which is scoped to PDF/document
     * export settings).
     */
    setupPanelSplitter() {
        const splitter = document.querySelector('.panel-splitter');
        const mainContent = document.querySelector('.main-content');
        const editorPanel = document.querySelector('.editor-panel');
        if (!splitter || !mainContent || !editorPanel) {
            console.error('Panel splitter elements not found');
            return;
        }

        const MIN_PANEL_PX = 250;
        const STORAGE_KEY = 'panelSplitRatio';

        const applyRatio = (ratio) => {
            mainContent.style.setProperty('--editor-width', `${ratio * 100}%`);
        };

        const persistCurrentRatio = () => {
            const ratio = editorPanel.getBoundingClientRect().width / mainContent.clientWidth;
            Storage.setItem(STORAGE_KEY, ratio);
        };

        const savedRatio = Storage.getItem(STORAGE_KEY);
        if (typeof savedRatio === 'number' && savedRatio > 0 && savedRatio < 1) {
            applyRatio(savedRatio);
        }

        let startX = 0;
        let startWidth = 0;

        const onMouseMove = (e) => {
            const totalWidth = mainContent.clientWidth;
            const maxWidth = totalWidth - MIN_PANEL_PX - splitter.offsetWidth;
            const newWidth = Math.min(maxWidth, Math.max(MIN_PANEL_PX, startWidth + (e.clientX - startX)));
            applyRatio(newWidth / totalWidth);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            persistCurrentRatio();
            // Panel widths changed, so cached scroll-sync positions are stale.
            this.editor?.rebuildContentMap();
        };

        splitter.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            startWidth = editorPanel.getBoundingClientRect().width;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Basic keyboard support for the ARIA separator role.
        splitter.addEventListener('keydown', (e) => {
            const totalWidth = mainContent.clientWidth;
            const currentWidth = editorPanel.getBoundingClientRect().width;
            const step = totalWidth * 0.02;

            if (e.key === 'ArrowLeft') {
                applyRatio(Math.max(MIN_PANEL_PX, currentWidth - step) / totalWidth);
            } else if (e.key === 'ArrowRight') {
                applyRatio(Math.min(totalWidth - MIN_PANEL_PX - splitter.offsetWidth, currentWidth + step) / totalWidth);
            } else if (e.key === 'Home') {
                applyRatio(0.5);
            } else {
                return;
            }
            e.preventDefault();
            persistCurrentRatio();
            this.editor?.rebuildContentMap();
        });
    }

    /**
     * Set up settings change listener to update preview
     */
    setupSettingsListener() {
        // Listen for settings changes from the settings manager
        // We'll add a custom event that SettingsManager can dispatch
        document.addEventListener('settingsChanged', () => {
            // Update preview when settings change (margins affect both preview modes)
            if (this.editor) {
                this.editor.updatePreview();
            }
        });
    }

    /**
     * Set up image panel toggle button
     */
    setupImagePanelToggle() {
        const toggleButton = document.getElementById('images-toggle');
        if (!toggleButton) {
            console.error('Images toggle button not found');
            return;
        }

        toggleButton.addEventListener('click', () => {
            this.imagePanel.toggle();
        });
    }

    /**
     * Set up TOC panel toggle button
     */
    setupTocPanelToggle() {
        const toggleButton = document.getElementById('toc-toggle');
        if (!toggleButton) {
            console.error('TOC toggle button not found');
            return;
        }

        toggleButton.addEventListener('click', () => {
            this.tocPanel.toggle();
        });
    }

    /**
     * Set up settings overlay click to close
     */
    setupSettingsOverlay() {
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.settingsManager.closePanel();
            });
        }
    }

    /**
     * Set up custom CSS functionality
     */
    setupCustomCSS() {
        const customCSSTextarea = document.getElementById('custom-css');
        const applyButton = document.getElementById('custom-css-apply');
        const clearButton = document.getElementById('custom-css-clear');

        if (!customCSSTextarea || !applyButton || !clearButton) {
            console.warn('Custom CSS elements not found');
            return;
        }

        // Load existing custom CSS into textarea
        const existingCSS = this.themeManager.getCustomCSS();
        if (existingCSS) {
            customCSSTextarea.value = existingCSS;
        }

        // Apply button handler
        applyButton.addEventListener('click', () => {
            const css = customCSSTextarea.value;
            this.themeManager.setCustomCSS(css);
            this.showNotification('Custom CSS applied successfully!', 'success');
            
            // Update preview to reflect changes
            if (this.editor) {
                this.editor.updatePreview();
            }
        });

        // Clear button handler
        clearButton.addEventListener('click', async () => {
            if (await retroDialog.confirm('Are you sure you want to clear all custom CSS?', 'Clear Custom CSS')) {
                customCSSTextarea.value = '';
                this.themeManager.clearCustomCSS();
                this.showNotification('Custom CSS cleared', 'info');
                
                // Update preview to reflect changes
                if (this.editor) {
                    this.editor.updatePreview();
                }
            }
        });
    }

    /**
     * Set up editor enhancement buttons
     */
    setupEditorEnhancements() {
        // Line numbers toggle
        const lineNumbersToggle = document.getElementById('editor-line-numbers-toggle');
        if (lineNumbersToggle) {
            lineNumbersToggle.addEventListener('click', () => {
                const enabled = this.editor.toggleLineNumbers();
                lineNumbersToggle.setAttribute('data-active', enabled.toString());
                this.showNotification(
                    `Line numbers ${enabled ? 'enabled' : 'disabled'}`,
                    'info'
                );
            });
        }

        // Find/Replace toggle
        const findToggle = document.getElementById('editor-find-toggle');
        if (findToggle) {
            findToggle.addEventListener('click', () => {
                this.editor.toggleFindReplace(true);
            });
        }
    }

    /**
     * Set up scroll synchronization
     */
    setupScrollSync() {
        // Initialize scroll sync in editor
        if (this.editor && typeof this.editor.initScrollSync === 'function') {
            this.editor.initScrollSync();
        }
        
        // Set up scroll sync toggle button
        const scrollSyncToggle = document.getElementById('editor-scroll-sync-toggle');
        if (scrollSyncToggle && this.editor) {
            scrollSyncToggle.addEventListener('click', () => {
                const enabled = this.editor.toggleScrollSync();
                // Button state is updated by editor.updateScrollSyncButton()
            });
        }
        
        // Set up keyboard shortcut (Alt+S)
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (this.editor && typeof this.editor.toggleScrollSync === 'function') {
                    this.editor.toggleScrollSync();
                }
            }
        });
    }
    
    /**
     * Initialize retro layout (Windows 95 style desktop)
     */
    initRetroLayout() {
        try {
            this.retroLayout = new RetroLayout();
            
            // Expose globally for debugging
            window.markdownPDFApp.retroLayout = this.retroLayout;
            
            // Auto-open the main editor window on startup
            setTimeout(() => {
                this.retroLayout.openMainWindow();
            }, 500);
        } catch (error) {
            console.error('Error initializing retro layout:', error);
            this.showNotification('Failed to initialize retro interface', 'error');

            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                appContainer.style.display = 'flex';
            }
        }
    }

    /**
     * Show notification to user
     * @param {string} message - Message to display
     * @param {string} type - Notification type ('success', 'error', 'info')
     */
    showNotification(message, type = 'info') {
        if (type !== 'error') return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #fee;
            border: 2px solid #fcc;
            padding: 2rem;
            border-radius: 0.5rem;
            max-width: 500px;
            z-index: 9999;
        `;
        errorDiv.innerHTML = `
            <h3 style="margin: 0 0 1rem 0; color: #c00;">Error</h3>
            <p style="margin: 0;">${message}</p>
        `;
        document.body.appendChild(errorDiv);
    }
}

// Initialize application
const app = new App();

// Export for debugging purposes
window.markdownPDFApp = app;
