/**
 * ExportManager Module
 * Handles all export functionalities: PDF, HTML, Print Preview, Batch Export
 */

import { getCodeTheme } from './codeThemeRegistry.js';
import { GOOGLE_FONTS_URL } from './webFonts.js';
import * as Storage from './Storage.js';

export class ExportManager {
    constructor(pdfService, renderer, settingsManager) {
        this.pdfService = pdfService;
        this.renderer = renderer;
        this.settingsManager = settingsManager;
        this.exportSettings = this.loadExportSettings();
    }

    /**
     * Load export settings from localStorage
     * @returns {Object} Export settings
     */
    loadExportSettings() {
        return Storage.getItem('exportSettings') || this.getDefaultExportSettings();
    }

    /**
     * Get default export settings
     * @returns {Object} Default settings
     */
    getDefaultExportSettings() {
        return {
            defaultFilename: 'document',
            includeTimestamp: false,
            htmlOptions: {
                standalone: true,
                includeStyles: true,
                embedImages: true
            },
            printOptions: {
                showPageBreaks: true,
                showMargins: true
            }
        };
    }

    /**
     * Save export settings to localStorage
     */
    saveExportSettings() {
        Storage.setItem('exportSettings', this.exportSettings);
    }

    /**
     * Generate filename with optional timestamp
     * @param {string} baseName - Base filename
     * @returns {string} Final filename
     */
    generateFilename(baseName = null) {
        let filename = baseName || this.exportSettings.defaultFilename;
        
        if (this.exportSettings.includeTimestamp) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            filename += `_${timestamp}`;
        }
        
        return filename;
    }

    /**
     * Show custom filename dialog
     * @param {string} defaultName - Default filename
     * @param {string} extension - File extension (pdf, html, etc.)
     * @returns {Promise<string|null>} Chosen filename or null if cancelled
     */
    async showFilenameDialog(defaultName = 'document', extension = 'pdf') {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'export-filename-modal-overlay';
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'export-filename-modal';
            modal.innerHTML = `
                <div class="export-filename-header">
                    <h3>Choose Filename</h3>
                    <button class="export-filename-close" aria-label="Close">&times;</button>
                </div>
                <div class="export-filename-body">
                    <div class="export-filename-field">
                        <label for="export-filename-input">Filename:</label>
                        <div class="export-filename-input-group">
                            <input 
                                type="text" 
                                id="export-filename-input" 
                                value="${defaultName}"
                                placeholder="Enter filename"
                            >
                            <span class="export-filename-extension">.${extension}</span>
                        </div>
                    </div>
                    <div class="export-filename-options">
                        <label>
                            <input type="checkbox" id="export-timestamp-checkbox" ${this.exportSettings.includeTimestamp ? 'checked' : ''}>
                            Include timestamp
                        </label>
                        <label>
                            <input type="checkbox" id="export-remember-checkbox">
                            Remember as default
                        </label>
                    </div>
                    <div class="export-filename-preview">
                        <strong>Preview:</strong>
                        <code id="export-filename-preview-text">${defaultName}.${extension}</code>
                    </div>
                </div>
                <div class="export-filename-footer">
                    <button class="export-filename-btn export-filename-cancel">Cancel</button>
                    <button class="export-filename-btn export-filename-confirm">Export</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const input = modal.querySelector('#export-filename-input');
            const timestampCheckbox = modal.querySelector('#export-timestamp-checkbox');
            const rememberCheckbox = modal.querySelector('#export-remember-checkbox');
            const preview = modal.querySelector('#export-filename-preview-text');
            const closeBtn = modal.querySelector('.export-filename-close');
            const cancelBtn = modal.querySelector('.export-filename-cancel');
            const confirmBtn = modal.querySelector('.export-filename-confirm');

            // Update preview
            const updatePreview = () => {
                let filename = input.value.trim() || defaultName;
                if (timestampCheckbox.checked) {
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    filename += `_${timestamp}`;
                }
                preview.textContent = `${filename}.${extension}`;
            };

            // Event listeners
            input.addEventListener('input', updatePreview);
            timestampCheckbox.addEventListener('change', updatePreview);
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                } else if (e.key === 'Escape') {
                    cancelBtn.click();
                }
            });

            const close = (filename = null) => {
                document.body.removeChild(overlay);
                resolve(filename);
            };

            closeBtn.addEventListener('click', () => close(null));
            cancelBtn.addEventListener('click', () => close(null));
            confirmBtn.addEventListener('click', () => {
                const filename = input.value.trim() || defaultName;
                
                // Update settings if remember is checked
                if (rememberCheckbox.checked) {
                    this.exportSettings.defaultFilename = filename;
                    this.exportSettings.includeTimestamp = timestampCheckbox.checked;
                    this.saveExportSettings();
                }
                
                // Generate final filename with timestamp if needed
                const finalFilename = timestampCheckbox.checked 
                    ? `${filename}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`
                    : filename;
                
                close(finalFilename);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    close(null);
                }
            });

            // Focus input and select text
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);
        });
    }

    /**
     * Export as PDF.
     * @param {string} markdown - Markdown content
     * @param {string} theme - Current theme
     * @param {Object} settings - PDF settings
     * @param {string} [codeTheme] - Code block theme name
     */
    async exportAsPDF(markdown, theme, settings = null, codeTheme = 'default') {
        try {
            const filename = this.generateFilename();

            // Generate PDF (opens the browser's native print dialog)
            await this.pdfService.generatePDF(
                markdown,
                this.renderer,
                theme,
                settings,
                filename,
                codeTheme
            );
        } catch (error) {
            console.error('PDF export error:', error);
            this.showNotification('❌ PDF export failed: ' + error.message, 'error');
        }
    }

    /**
     * Export as HTML
     * @param {string} markdown - Markdown content
     * @param {string} theme - Current theme
     * @param {string} [codeTheme] - Code block theme name
     */
    async exportAsHTML(markdown, theme, codeTheme = 'default') {
        try {
            // Show filename dialog
            const filename = await this.showFilenameDialog(
                this.exportSettings.defaultFilename,
                'html'
            );

            if (!filename) {
                return; // User cancelled
            }

            // Generate HTML (now async)
            const html = await this.generateStandaloneHTML(markdown, theme, codeTheme);

            // Download HTML file
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('✅ HTML exported successfully', 'success');
        } catch (error) {
            console.error('HTML export error:', error);
            this.showNotification('❌ HTML export failed: ' + error.message, 'error');
        }
    }

    /**
     * Fetch a same-origin CSS file's raw text.
     * @param {string} path - Same-origin path, e.g. 'css/themes/modern.css'
     * @returns {Promise<string>} CSS text, or '' on failure
     */
    async fetchCSS(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`${path} responded ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error('Error fetching CSS for export:', error);
            return '';
        }
    }

    /**
     * @param {string} theme - Main theme name
     * @param {string} codeTheme - Code theme name; 'default' means no override
     * @returns {{hljsUrl: string, bodyClass: string}}
     */
    resolveCodeTheme(theme, codeTheme) {
        const codeThemeEntry = codeTheme && codeTheme !== 'default' ? getCodeTheme(codeTheme) : null;
        const hljsUrl = codeThemeEntry?.hljsUrl || 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        const bodyClass = codeThemeEntry ? `theme-${theme} code-theme-${codeTheme}` : `theme-${theme}`;
        return { hljsUrl, bodyClass };
    }

    /**
     * Generate standalone HTML with embedded styles
     * @param {string} markdown - Markdown content
     * @param {string} theme - Theme name
     * @param {string} [codeTheme] - Code block theme name (see codeThemeRegistry.js); 'default' means no override
     * @returns {Promise<string>} Complete HTML document
     */
    async generateStandaloneHTML(markdown, theme, codeTheme = 'default') {
        // Render markdown to HTML (await the Promise)
        const content = await this.renderer.render(markdown);

        const themeCSS = await this.fetchCSS(`css/themes/${theme}.css`);
        const codeBlockThemeCSS = await this.fetchCSS('css/code-block-themes.css');
        const { hljsUrl, bodyClass } = this.resolveCodeTheme(theme, codeTheme);

        // Build complete HTML document
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Document</title>
    <meta name="generator" content="Markdown to PDF Converter">

    <!-- Syntax Highlighting -->
    <link rel="stylesheet" href="${hljsUrl}">

    <!-- Web font fallbacks for the font-family setting (see webFonts.js) -->
    <link rel="stylesheet" href="${GOOGLE_FONTS_URL}">

    <!-- Mermaid -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

    <style>
        /* Base Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            background: #fff;
        }

        ${themeCSS}
        ${codeBlockThemeCSS}

        /* Print Styles */
        @media print {
            body {
                max-width: none;
                padding: 0;
            }

            @page {
                margin: 20mm;
            }
        }
    </style>
</head>
<body class="${bodyClass}">
    <div id="content" class="preview-content">
        ${content}
    </div>

    <script>
        // Initialize Mermaid
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose'
        });

        // Initialize syntax highlighting
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof hljs !== 'undefined') {
                document.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        });
    </script>

    <!-- Highlight.js -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
</body>
</html>`;

        return html;
    }

    /**
     * Open print preview mode
     * @param {HTMLElement} previewElement - Preview container
     * @param {string} theme - Current theme
     * @param {string} [codeTheme] - Code block theme name (see codeThemeRegistry.js); 'default' means no override
     */
    async openPrintPreview(previewElement, theme, codeTheme = 'default') {
        try {
            const printWindow = window.open('', '_blank', 'width=900,height=700');

            if (!printWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }

            // Get content
            const content = previewElement.innerHTML;
            const themeCSS = await this.fetchCSS(`css/themes/${theme}.css`);
            const codeBlockThemeCSS = await this.fetchCSS('css/code-block-themes.css');
            const { hljsUrl, bodyClass } = this.resolveCodeTheme(theme, codeTheme);

            // Build print document
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Print Preview</title>
                    <link rel="stylesheet" href="${hljsUrl}">
                    <link rel="stylesheet" href="${GOOGLE_FONTS_URL}">
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }

                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            padding: 2rem;
                            background: #fff;
                        }

                        ${themeCSS}
                        ${codeBlockThemeCSS}

                        /* Print-specific styles */
                        @media print {
                            body {
                                padding: 0;
                            }
                            
                            @page {
                                margin: 20mm;
                                size: A4;
                            }
                            
                            .no-print {
                                display: none;
                            }
                            
                            /* Page break controls */
                            h1, h2, h3 {
                                page-break-after: avoid;
                            }
                            
                            pre, blockquote, table {
                                page-break-inside: avoid;
                            }
                        }
                        
                        /* Print toolbar */
                        .print-toolbar {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            background: #1e293b;
                            color: white;
                            padding: 1rem;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            z-index: 1000;
                        }
                        
                        .print-content {
                            margin-top: 60px;
                            max-width: 900px;
                            margin-left: auto;
                            margin-right: auto;
                        }
                        
                        .print-btn {
                            background: #0ea5e9;
                            color: white;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            margin-left: 0.5rem;
                        }
                        
                        .print-btn:hover {
                            background: #0284c7;
                        }
                        
                        @media print {
                            .print-toolbar {
                                display: none;
                            }
                            
                            .print-content {
                                margin-top: 0;
                            }
                        }
                    </style>
                </head>
                <body class="${bodyClass}">
                    <div class="print-toolbar no-print">
                        <div>
                            <strong>Print Preview</strong>
                            <span style="margin-left: 1rem; opacity: 0.8;">Ready to print</span>
                        </div>
                        <div>
                            <button class="print-btn" onclick="window.print()">🖨️ Print</button>
                            <button class="print-btn" onclick="window.close()">Close</button>
                        </div>
                    </div>
                    <div class="print-content preview-content">
                        ${content}
                    </div>
                </body>
                </html>
            `);

            printWindow.document.close();

            this.showNotification('✅ Print preview opened', 'success');
        } catch (error) {
            console.error('Print preview error:', error);
            this.showNotification('❌ ' + error.message, 'error');
        }
    }

    /**
     * Batch export multiple formats
     * @param {string} markdown - Markdown content
     * @param {string} theme - Current theme
     * @param {Object} settings - PDF settings
     * @param {Array<string>} formats - Formats to export (pdf, html)
     * @param {string} [codeTheme] - Code block theme name (see codeThemeRegistry.js); 'default' means no override
     */
    async batchExport(markdown, theme, settings, formats = ['pdf', 'html'], codeTheme = 'default') {
        try {
            // Show filename dialog once
            const baseFilename = await this.showFilenameDialog(
                this.exportSettings.defaultFilename,
                'multiple'
            );

            if (!baseFilename) {
                return; // User cancelled
            }

            const results = [];

            // Export each format
            for (const format of formats) {
                try {
                    if (format === 'pdf') {
                        await this.pdfService.generatePDF(
                            markdown,
                            this.renderer,
                            theme,
                            settings,
                            baseFilename,
                            codeTheme
                        );
                        results.push({ format: 'PDF', success: true });
                    } else if (format === 'html') {
                        const html = await this.generateStandaloneHTML(markdown, theme, codeTheme);
                        const blob = new Blob([html], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${baseFilename}.html`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        results.push({ format: 'HTML', success: true });
                    }
                    
                    // Small delay between exports
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`${format} export error:`, error);
                    results.push({ format: format.toUpperCase(), success: false, error: error.message });
                }
            }

            // Show results
            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            
            if (successCount === totalCount) {
                this.showNotification(`✅ All ${totalCount} files exported successfully`, 'success');
            } else {
                this.showNotification(`⚠️ ${successCount}/${totalCount} files exported`, 'warning');
            }
        } catch (error) {
            console.error('Batch export error:', error);
            this.showNotification('❌ Batch export failed', 'error');
        }
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning)
     */
    showNotification(message, type = 'info') {
        if (type !== 'error') return;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `export-notification export-notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Update export settings
     * @param {Object} newSettings - New settings to merge
     */
    updateSettings(newSettings) {
        this.exportSettings = { ...this.exportSettings, ...newSettings };
        this.saveExportSettings();
    }

    /**
     * Get current export settings
     * @returns {Object} Current settings
     */
    getSettings() {
        return { ...this.exportSettings };
    }
}
