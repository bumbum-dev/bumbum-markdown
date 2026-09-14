/**
 * RetroWindowContent - Window Content Builders
 */

import { RetroWindow } from './RetroWindow.js';
import retroSettingsPanel from './RetroSettingsPanel.js';
import retroSounds from './sounds/RetroSounds.js';
import retroDialog from './RetroDialog.js';
import { THEMES } from '../modules/themeRegistry.js';
import { CODE_THEMES } from '../modules/codeThemeRegistry.js';
import { APP_NAME, APP_VERSION, APP_TAGLINE, GITHUB_URL } from '../modules/appInfo.js';

export class RetroWindowContent {
    constructor(layout) {
        this.layout = layout;
        this.settingsContentEl = null;
    }

    /**
     * Open the main editor window
     */
    openMainWindow() {
        const windowId = 'main-editor';
        
        // Check if window already exists
        if (this.layout.windows.has(windowId)) {
            // Restore if minimized, otherwise bring to front
            if (this.layout.state.isMinimized(windowId)) {
                this.layout.state.restoreWindow(windowId);
            } else {
                this.layout.state.setActiveWindow(windowId);
            }
            return;
        }
        
        const mainWindowWidth = 1000;
        const mainWindowHeight = 650;
        const centeredX = Math.max(20, (this.layout.desktop.clientWidth - mainWindowWidth) / 2);
        const centeredY = Math.max(20, (this.layout.desktop.clientHeight - mainWindowHeight) * 0.3);

        const window = new RetroWindow({
            title: 'Markdown Editor',
            icon: '📝',
            initialX: centeredX,
            initialY: centeredY,
            width: mainWindowWidth,
            height: mainWindowHeight,
            resizable: true,
            minWidth: 700,
            minHeight: 450,
            onClose: () => this.layout.closeWindow(windowId),
            onMinimize: () => this.layout.minimizeWindow(windowId),
            onMaximize: () => this.layout.maximizeWindow(windowId),
            onFocus: () => this.layout.focusWindow(windowId),

            onResize: () => globalThis.markdownPDFApp?.editor?.rebuildContentMap?.()
        });
        
        // Get the existing app content
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.style.display = 'flex';
            
            // Create container with toolbar
            const containerWithToolbar = document.createElement('div');
            containerWithToolbar.style.display = 'flex';
            containerWithToolbar.style.flexDirection = 'column';
            containerWithToolbar.style.height = '100%';
            
            // Create and append toolbar
            const toolbar = this.createDocumentToolbar();
            containerWithToolbar.appendChild(toolbar);
            
            // Append app container
            containerWithToolbar.appendChild(appContainer);
            
            window.setContent(containerWithToolbar);
            
            // Wire up toolbar events
            this.attachToolbarEvents(containerWithToolbar);
        }
        
        // Mount window
        window.mount(this.layout.windowsContainer);
        
        // Register in state
        this.layout.windows.set(windowId, window);
        this.layout.state.registerWindow(windowId, {
            title: 'Markdown Editor',
            icon: '📝'
        });
        this.layout.state.setActiveWindow(windowId);
        
        // Add to taskbar
        this.layout.updateTaskbar();
    }

    /**
     * Handle menu actions from start menu
     * @param {string} action - Action identifier
     */
    handleMenuAction(action) {
        this.layout.closeStartMenu();
        
        switch (action) {
            case 'new-document':
                // Clear editor
                if (window.markdownPDFApp && window.markdownPDFApp.fileManager) {
                    window.markdownPDFApp.fileManager.clearEditor();
                }
                this.openMainWindow();
                break;
                
            case 'open-file':
                // Trigger file open
                document.getElementById('file-open')?.click();
                this.openMainWindow();
                break;
                
            case 'save':
                // Trigger save
                document.getElementById('file-save')?.click();
                break;
                
            case 'settings':
                this.openSettingsWindow();
                break;

            case 'images':
                this.openImagesWindow();
                break;
                
            case 'retro-effects':
                this.openRetroEffectsWindow();
                break;
                
            case 'manual':
                this.showManual();
                break;

            case 'help':
                this.showHelp();
                break;
                
            case 'about':
                this.showAbout();
                break;

            case 'github':
                window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
                break;
        }
    }

    /**
     * Open Settings window
     */
    openSettingsWindow() {
        const windowId = 'settings';
        
        // Check if window already exists
        if (this.layout.windows.has(windowId)) {
            if (this.layout.state.isMinimized(windowId)) {
                this.layout.state.restoreWindow(windowId);
            } else {
                this.layout.state.setActiveWindow(windowId);
            }
            return;
        }
        
        // Create new window
        const retroWindow = new RetroWindow({
            title: 'PDF Settings',
            icon: '⚙️',
            initialX: 150,
            initialY: 80,
            width: 600,
            height: 500,
            onClose: () => this.layout.closeWindow(windowId),
            onMinimize: () => this.layout.minimizeWindow(windowId),
            onMaximize: () => this.layout.maximizeWindow(windowId),
            onFocus: () => this.layout.focusWindow(windowId)
        });

        if (!this.settingsContentEl) {
            const settingsPanel = document.getElementById('settings-panel');
            this.settingsContentEl = settingsPanel ? settingsPanel.querySelector('.settings-content') : null;
        }
        if (this.settingsContentEl) {
            this.settingsContentEl.classList.add('settings-content-embedded');
            retroWindow.setContent(this.settingsContentEl);
        }

        // Hide the original panel/overlay (only the header is left behind in it now)
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) settingsPanel.style.display = 'none';
        const overlay = document.getElementById('settings-overlay');
        if (overlay) overlay.style.display = 'none';

        // Mount window
        retroWindow.mount(this.layout.windowsContainer);

        // Register in state
        this.layout.windows.set(windowId, retroWindow);
        this.layout.state.registerWindow(windowId, {
            title: 'PDF Settings',
            icon: '⚙️'
        });
        this.layout.state.setActiveWindow(windowId);
        
        // Add to taskbar
        this.layout.updateTaskbar();
    }

    /**
     * Open Images window
     * @param {number|null} insertPosition - Editor cursor offset to insert the picked image
     */
    openImagesWindow(insertPosition = null) {
        const windowId = 'images';

        if (window.markdownPDFApp && window.markdownPDFApp.imagePanel) {
            window.markdownPDFApp.imagePanel.insertPosition = insertPosition;
        }

        // Check if window already exists
        if (this.layout.windows.has(windowId)) {
            if (this.layout.state.isMinimized(windowId)) {
                this.layout.state.restoreWindow(windowId);
            } else {
                this.layout.state.setActiveWindow(windowId);
            }
            return;
        }
        
        // Create new window
        const retroWindow = new RetroWindow({
            title: 'Image Manager',
            icon: '📷',
            initialX: 300,
            initialY: 140,
            width: 650,
            height: 550,
            onClose: () => this.layout.closeWindow(windowId),
            onMinimize: () => this.layout.minimizeWindow(windowId),
            onMaximize: () => this.layout.maximizeWindow(windowId),
            onFocus: () => this.layout.focusWindow(windowId)
        });

        // Embed the real image panel (not a clone) so its buttons/uploads keep working
        if (window.markdownPDFApp && window.markdownPDFApp.imagePanel) {
            const imagePanel = window.markdownPDFApp.imagePanel;
            const panelEl = imagePanel.panel;

            panelEl.classList.add('image-panel-embedded');
            retroWindow.setContent(panelEl);

            imagePanel.refreshGrid();
            imagePanel.updateStorageIndicator();
        }

        // Mount window
        retroWindow.mount(this.layout.windowsContainer);

        // Register in state
        this.layout.windows.set(windowId, retroWindow);
        this.layout.state.registerWindow(windowId, {
            title: 'Image Manager',
            icon: '📷'
        });
        this.layout.state.setActiveWindow(windowId);
        
        // Add to taskbar
        this.layout.updateTaskbar();
    }

    /**
     * Create document toolbar
     * @returns {HTMLElement} Toolbar element
     */
    createDocumentToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'document-toolbar';
        
        toolbar.innerHTML = `
            <div class="document-toolbar-group">
                <button class="toolbar-btn" data-action="open" title="Open Markdown file">
                    📁 Open
                </button>
                <button class="toolbar-btn" data-action="save" title="Save to browser">
                    💾 Save
                </button>
                <button class="toolbar-btn" data-action="load" title="Load saved project">
                    📂 Load
                </button>
            </div>
            
            <div class="document-toolbar-divider"></div>
            
            <div class="document-toolbar-group">
                <button class="toolbar-btn" data-action="export" title="Export as .md">
                    📤 Export
                </button>
                <button class="toolbar-btn" data-action="clear" title="Clear editor">
                    🗑️ Clear
                </button>
            </div>
            
            <div class="document-toolbar-divider"></div>
            
            <div class="document-toolbar-group">
                <label class="toolbar-label" for="toolbar-theme-selector">Theme:</label>
                <select id="toolbar-theme-selector" class="toolbar-theme-selector" title="Select PDF theme">
                    ${THEMES.map(theme => `<option value="${theme.name}">${theme.displayName}</option>`).join('')}
                </select>
            </div>

            <div class="document-toolbar-group">
                <label class="toolbar-label" for="toolbar-code-theme-selector">Code Theme:</label>
                <select id="toolbar-code-theme-selector" class="toolbar-theme-selector" title="Select code block theme">
                    ${CODE_THEMES.map(theme => `<option value="${theme.name}">${theme.displayName}</option>`).join('')}
                </select>
            </div>

            <div class="document-toolbar-divider"></div>
            
            <div class="document-toolbar-group">
                <button class="toolbar-btn" data-action="images" title="Image Manager">
                    📷 Images
                </button>
                <button class="toolbar-btn" data-action="toc" title="Table of Contents">
                    📑 TOC
                </button>
            </div>

            <div class="document-toolbar-divider"></div>

            <div class="document-toolbar-group">
                <button class="toolbar-btn" data-action="settings" title="PDF Settings">
                    ⚙️ Settings
                </button>
            </div>
            
            <div class="document-toolbar-spacer"></div>
            
            <div class="document-toolbar-group">
                <button class="toolbar-btn toolbar-btn-primary" data-action="export-pdf" title="Export as PDF">
                    📥 Export PDF
                </button>
            </div>
        `;
        
        return toolbar;
    }

    /**
     * Attach event listeners to toolbar buttons
     * @param {HTMLElement} container - Container with toolbar
     */
    attachToolbarEvents(container) {
        const toolbar = container.querySelector('.document-toolbar');
        if (!toolbar) return;
        
        // Get all toolbar buttons
        const buttons = toolbar.querySelectorAll('.toolbar-btn');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = button.getAttribute('data-action');
                this.handleToolbarAction(action);
            });
        });
        
        // Theme selector
        const themeSelector = toolbar.querySelector('#toolbar-theme-selector');
        if (themeSelector) {
            const originalThemeSelector = container.querySelector('#theme-selector');
            if (originalThemeSelector) {
                themeSelector.value = originalThemeSelector.value;
            }
            
            themeSelector.addEventListener('change', (e) => {
                // Update the original theme selector to trigger theme change
                if (originalThemeSelector) {
                    originalThemeSelector.value = e.target.value;
                    originalThemeSelector.dispatchEvent(new Event('change'));
                }
            });
        }

        const codeThemeSelector = toolbar.querySelector('#toolbar-code-theme-selector');
        if (codeThemeSelector) {
            const originalCodeThemeSelector = container.querySelector('#code-theme-selector');
            if (originalCodeThemeSelector) {
                codeThemeSelector.value = originalCodeThemeSelector.value;
            }

            codeThemeSelector.addEventListener('change', (e) => {
                if (originalCodeThemeSelector) {
                    originalCodeThemeSelector.value = e.target.value;
                    originalCodeThemeSelector.dispatchEvent(new Event('change'));
                }
            });
        }
    }

    /**
     * Handle toolbar actions
     * @param {string} action - Action identifier
     */
    handleToolbarAction(action) {
        switch (action) {
            case 'open':
                document.getElementById('file-open')?.click();
                break;
                
            case 'save':
                document.getElementById('file-save')?.click();
                break;
                
            case 'load':
                document.getElementById('file-load')?.click();
                break;
                
            case 'export':
                document.getElementById('file-export')?.click();
                break;
                
            case 'clear':
                document.getElementById('file-clear')?.click();
                break;
                
            case 'images':
                this.openImagesWindow();
                break;

            case 'toc':
                window.markdownPDFApp?.tocPanel?.toggle();
                break;

            case 'settings':
                this.openSettingsWindow();
                break;

            case 'export-pdf':
                document.getElementById('export-pdf')?.click();
                break;
        }
    }

    /**
     * Open Retro Effects settings window
     */
    openRetroEffectsWindow() {
        retroSounds.playSound('click');
        retroSettingsPanel.open();
    }

    /**
     * Load the repo's demo.md into the editor
     */
    async openDemoMarkdown() {
        if (!await retroDialog.confirm('Load the demo document? This will replace your current editor content.', 'Load Demo')) {
            return;
        }

        try {
            const response = await fetch('demo.md');
            if (!response.ok) {
                throw new Error(`demo.md responded ${response.status}`);
            }
            const markdown = await response.text();

            this.openMainWindow();
            window.markdownPDFApp?.fileManager?.editor.setContent(markdown);
        } catch (error) {
            console.error('Failed to load demo.md:', error);
        }
    }

    /**
     * Open a live-rendered preview of demo.md's PDF output in a new tab
     */
    async openDemoPDF() {
        try {
            const response = await fetch('demo.md');
            if (!response.ok) {
                throw new Error(`demo.md responded ${response.status}`);
            }
            const markdown = await response.text();

            const exportManager = window.markdownPDFApp?.exportManager;
            if (!exportManager) return;

            // Same theme/code-theme read as Editor.updateDocumentPreview()
            const theme = document.getElementById('theme-selector')?.value || 'modern';
            const codeTheme = document.getElementById('code-theme-selector')?.value || 'default';

            const html = await exportManager.generateStandaloneHTML(markdown, theme, codeTheme);
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Failed to open demo PDF preview:', error);
        }
    }

    /**
     * Open a small, single-instance content window
     * @param {string} windowId - Unique window id ('help', 'about', ...)
     * @param {string} title - Window titlebar text
     * @param {string} icon - Window titlebar icon
     * @param {string} contentHTML - Window body, as an HTML string (see RetroWindow.setContent)
     * @param {{width?: number, height?: number}} [size] - Override the default 420x380 (e.g. for the longer Manual window)
     */
    openInfoWindow(windowId, title, icon, contentHTML, size = {}) {
        if (this.layout.windows.has(windowId)) {
            if (this.layout.state.isMinimized(windowId)) {
                this.layout.state.restoreWindow(windowId);
            } else {
                this.layout.state.setActiveWindow(windowId);
            }
            return;
        }

        const retroWindow = new RetroWindow({
            title,
            icon,
            initialX: 220,
            initialY: 120,
            width: size.width || 420,
            height: size.height || 380,
            onClose: () => this.layout.closeWindow(windowId),
            onMinimize: () => this.layout.minimizeWindow(windowId),
            onMaximize: () => this.layout.maximizeWindow(windowId),
            onFocus: () => this.layout.focusWindow(windowId)
        });

        retroWindow.setContent(contentHTML);
        retroWindow.mount(this.layout.windowsContainer);

        this.layout.windows.set(windowId, retroWindow);
        this.layout.state.registerWindow(windowId, { title, icon });
        this.layout.state.setActiveWindow(windowId);

        this.layout.updateTaskbar();
    }

    /**
     * Show help window
     */
    showHelp() {
        this.openInfoWindow('help', `${APP_NAME} - Help`, '❓', `
            <div class="info-window-content">
                <h3>Getting Started</h3>
                <ul>
                    <li>Double-click desktop icons to open windows.</li>
                    <li>Use the Start menu for quick access to features.</li>
                    <li>Click taskbar buttons to switch between open windows.</li>
                </ul>
                <h3>Keyboard Shortcuts</h3>
                <table class="info-window-shortcuts">
                    <tbody>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>Save</td></tr>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>O</kbd></td><td>Open</td></tr>
                        <tr><td><kbd>Alt</kbd> + <kbd>S</kbd></td><td>Toggle scroll sync</td></tr>
                        <tr><td><kbd>Alt</kbd> + <kbd>L</kbd></td><td>Toggle line numbers</td></tr>
                    </tbody>
                </table>
            </div>
        `);
    }

    /**
     * Show about window
     */
    showAbout() {
        this.openInfoWindow('about', `About ${APP_NAME}`, 'ℹ️', `
            <div class="info-window-content info-window-content--centered">
                <div class="info-window-icon">📄</div>
                <h2>${APP_NAME}</h2>
                <p class="info-window-version">Version ${APP_VERSION} &middot; Retro Edition</p>
                <p>${APP_TAGLINE}</p>
                <p>Free and open-source, licensed under the MIT License.</p>
                <a class="win95-button win95-button--primary" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">🔗 View on GitHub</a>
            </div>
        `);
    }

    /**
     * Show the full user manual
     */
    showManual() {
        this.openInfoWindow('manual', `${APP_NAME} - Manual`, '📖', `
            <div class="info-window-content">
                <h3>Overview</h3>
                <p>${APP_NAME} is a browser-based editor for writing Markdown and turning it into a formatted PDF. Everything runs locally in the browser: there is no account, no upload, and no server processing your document.</p>

                <h3>The Desktop</h3>
                <p>The interface follows a desktop metaphor. Double-click an icon to open its window. The Start menu, in the bottom-left corner, gives the same actions as a menu. Open windows appear as buttons in the taskbar; click one to bring its window to the front, or to restore it if minimized.</p>

                <h3>Writing</h3>
                <p>Type Markdown in the editor on the left. Standard syntax is supported, including headings, lists, tables, links, images, blockquotes, and fenced code blocks with syntax highlighting. Fenced blocks written with the <code>mermaid</code> language render as diagrams, and inline or block math is rendered as well.</p>
                <p>The editor toolbar can toggle line numbers, toggle scroll synchronization with the preview, and open Find and Replace. Formatting shortcuts are listed below.</p>

                <h3>Preview</h3>
                <p>The panel on the right shows the rendered document. Switch between a plain rendered view and a paginated view that matches how the exported PDF will be paged. When scroll sync is enabled, scrolling one panel moves the other to the matching position.</p>

                <h3>Images</h3>
                <p>Open the Images panel from the toolbar or Start menu to add images to the document and insert them into the Markdown at the cursor position. Inserted images can be resized directly from the preview.</p>

                <h3>Table of Contents</h3>
                <p>Enable the table of contents from the toolbar or from PDF Settings. It is generated from the document's headings and can be limited to a chosen heading depth.</p>

                <h3>Themes</h3>
                <p>The theme selector changes the visual style of the exported document; the code theme selector changes the appearance of code blocks independently. Both apply to the preview and to the exported PDF or HTML.</p>

                <h3>PDF Settings</h3>
                <p>Open Settings from the toolbar or Start menu to control page size and margins, typography, headers and footers, document metadata (title, author, subject, keywords), an optional cover page, and custom CSS applied on top of the chosen theme. Settings can be exported to a file, imported back, or reset to defaults.</p>

                <h3>Saving, Loading, and Exporting</h3>
                <p>Save keeps a named copy of the current document in the browser's local storage, and Load brings one back. The document is also autosaved in the background, so a reload does not lose unsaved work. Open reads a Markdown file from disk, and Export writes the current document out as a Markdown file.</p>
                <p>Use Export PDF to generate the final PDF, or the export menu next to it for an HTML export, a print preview, or exporting several documents at once.</p>

                <h3>Retro Effects</h3>
                <p>Open Retro Effects from the Start menu to adjust the desktop's visual and audio effects, such as CRT-style rendering and interface sounds.</p>

                <h3>Data and Privacy</h3>
                <p>Documents, autosave data, settings, and images are stored only in this browser, using local storage and IndexedDB. Nothing is sent to a server. Clearing the browser's site data for this page removes everything stored here.</p>

                <h3>Keyboard Shortcuts</h3>
                <table class="info-window-shortcuts">
                    <tbody>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>Save</td></tr>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>O</kbd></td><td>Open</td></tr>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>B</kbd></td><td>Bold</td></tr>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>I</kbd></td><td>Italic</td></tr>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd></td><td>Inline code</td></tr>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>F</kbd></td><td>Find</td></tr>
                        <tr><td><kbd>Ctrl</kbd> + <kbd>H</kbd></td><td>Find and replace</td></tr>
                        <tr><td><kbd>Alt</kbd> + <kbd>S</kbd></td><td>Toggle scroll sync</td></tr>
                        <tr><td><kbd>Alt</kbd> + <kbd>L</kbd></td><td>Toggle line numbers</td></tr>
                    </tbody>
                </table>
            </div>
        `, { width: 640, height: 560 });
    }

}
