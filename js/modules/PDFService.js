/**
 * PDFService Module
 */

export class PDFService {
    constructor(pagedPreviewRenderer) {
        this.pagedPreviewRenderer = pagedPreviewRenderer;
    }

    /**
     * Generate a PDF from markdown via the browser's print dialog.
     * @param {string} markdown - Markdown source
     * @param {Renderer} renderer - Renderer instance (markdown -> HTML)
     * @param {string} theme - Current theme name
     * @param {Object} settings - PDF settings (margins, page size, fonts, etc.)
     * @param {string} filename - Suggested filename (sans extension)
     * @param {string} [codeTheme] - Code block theme name (see codeThemeRegistry.js); 'default' means no override
     * @returns {Promise<void>}
     */
    async generatePDF(markdown, renderer, theme, settings, filename = 'document', codeTheme = 'default') {
        await this.pagedPreviewRenderer.printToPDF(markdown, renderer, theme, settings, filename, codeTheme);
    }
}
