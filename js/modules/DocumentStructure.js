/**
 * Document Structure Module
 * Handles TOC generation, cover pages, headers/footers
 */

/**
 * Physical page dimensions in mm, keyed by page size name.
 */
const PAGE_DIMENSIONS_MM = {
    A4: { width: 210, height: 297 },
    Letter: { width: 215.9, height: 279.4 },
    Legal: { width: 215.9, height: 355.6 }
};

const PAGE_FIT_SAFETY_MARGIN_MM = 1;

export class DocumentStructure {
    constructor() {
        this.headings = [];
    }

    /**
     * Generate Table of Contents from headings
     * @param {HTMLElement} content - Content element to extract headings from
     * @param {Object} settings - TOC settings
     * @returns {string} TOC HTML
     */
    generateTOC(content, settings) {
        if (!settings.toc.enabled) {
            return '';
        }

        // Extract headings
        this.headings = this.extractHeadings(content, settings.toc.depth);

        if (this.headings.length === 0) {
            return '';
        }

        // Build TOC HTML
        let tocHTML = `<div class="table-of-contents">
            <h2 class="toc-title">${settings.toc.title || 'Table of Contents'}</h2>
            <ul class="toc-list">`;

        this.headings.forEach((heading) => {
            const indent = heading.level - 1;
            const indentClass = `toc-level-${indent}`;
            
            tocHTML += `
                <li class="${indentClass}">
                    <a href="#${heading.id}" class="toc-link">
                        ${heading.text}
                    </a>
                </li>`;
        });

        tocHTML += `
            </ul>
        </div>`;

        return tocHTML;
    }

    /**
     * Extract headings from content
     * @param {HTMLElement} content - Content element
     * @param {number} depth - Maximum heading depth
     * @returns {Array} Array of heading objects
     */
    extractHeadings(content, depth = 3) {
        const headings = [];
        const selector = Array.from({ length: depth }, (_, i) => `h${i + 1}`).join(', ');
        const headingElements = content.querySelectorAll(selector);

        headingElements.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1));
            const text = heading.textContent.trim();

            if (!heading.id) {
                heading.id = `heading-${index}`;
            }

            headings.push({
                level: level,
                text: text,
                id: heading.id
            });
        });

        return headings;
    }

    /**
     * Generate cover page HTML
     * @param {Object} settings - Cover page settings
     * @returns {string} Cover page HTML
     */
    generateCoverPage(settings) {
        if (!settings.coverPage.enabled) {
            return '';
        }

        const title = settings.coverPage.title || settings.metadata.title || 'Untitled Document';
        const subtitle = settings.coverPage.subtitle || '';
        const author = settings.coverPage.author || settings.metadata.author || '';
        const date = settings.coverPage.date || new Date().toLocaleDateString();
        const contentHeightMM = this.getPageContentHeightMM(settings);

        return `
        <div class="cover-page" style="
            min-height: ${contentHeightMM}mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 4rem 2rem;
        ">
            <h1 class="cover-title" style="
                font-size: 3rem;
                font-weight: bold;
                margin-bottom: 1.5rem;
                color: #1f2937;
            ">${this.escapeHtml(title)}</h1>
            
            ${subtitle ? `
            <h2 class="cover-subtitle" style="
                font-size: 1.5rem;
                color: #6b7280;
                margin-bottom: 3rem;
            ">${this.escapeHtml(subtitle)}</h2>
            ` : ''}
            
            <div class="cover-meta" style="
                margin-top: auto;
                font-size: 1.125rem;
                color: #4b5563;
            ">
                ${author ? `<p class="cover-author" style="margin-bottom: 0.5rem;"><strong>By:</strong> ${this.escapeHtml(author)}</p>` : ''}
                ${date ? `<p class="cover-date"><strong>Date:</strong> ${this.escapeHtml(date)}</p>` : ''}
            </div>
        </div>
        `;
    }

    /**
     * Build header template for Puppeteer
     * @param {Object} settings - Settings object
     * @returns {string} Header HTML (Puppeteer-compatible)
     */
    buildHeaderTemplate(settings) {
        if (!settings.headers?.enabled) {
            return '<div></div>';
        }

        let template = settings.headers.template || '';
        
        // Replace placeholders (but keep {page} and {total} for Puppeteer)
        template = template.replace(/{title}/g, settings.metadata?.title || '');
        template = template.replace(/{author}/g, settings.metadata?.author || '');
        template = template.replace(/{date}/g, new Date().toLocaleDateString());
        
        // Puppeteer requires a complete HTML structure with inline styles
        return `
        <div style="font-size: 10px; text-align: center; width: 100%; padding: 5px 0; border-bottom: 1px solid #e5e7eb; margin: 0 20px;">
            <span>${this.escapeHtml(template)}</span>
        </div>
        `;
    }

    /**
     * Build footer template for Puppeteer
     * @param {Object} settings - Settings object
     * @returns {string} Footer HTML (Puppeteer-compatible)
     */
    buildFooterTemplate(settings) {
        if (!settings.footers?.enabled) {
            return '<div></div>';
        }

        let template = '';
        
        if (settings.footers.pageNumbers && settings.footers.template) {
            template = settings.footers.template;
        } else if (settings.footers.pageNumbers) {
            template = 'Page {page} of {total}';
        } else if (settings.footers.template) {
            template = settings.footers.template;
        }

        if (!template) {
            return '<div></div>';
        }

        // Replace placeholders (page numbers will be handled by Puppeteer)
        template = template.replace(/{title}/g, settings.metadata?.title || '');
        template = template.replace(/{author}/g, settings.metadata?.author || '');
        template = template.replace(/{date}/g, new Date().toLocaleDateString());
        template = template.replace(/{page}/g, '<span class="pageNumber"></span>');
        template = template.replace(/{total}/g, '<span class="totalPages"></span>');
        
        // Puppeteer requires a complete HTML structure with inline styles
        return `
        <div style="font-size: 10px; text-align: center; width: 100%; padding: 5px 0; border-top: 1px solid #e5e7eb; margin: 0 20px;">
            <span>${template}</span>
        </div>
        `;
    }

    /**
     * Prepare content for PDF generation
     * @param {HTMLElement} content - Original content
     * @param {Object} settings - All settings
     * @returns {HTMLElement} Prepared content with TOC and cover page
     */
    prepareContent(content, settings) {
        // Clone content to avoid modifying the original
        const clone = content.cloneNode(true);
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-content';
        
        // Add cover page if enabled
        if (settings.coverPage.enabled) {
            const coverDiv = document.createElement('div');
            coverDiv.innerHTML = this.generateCoverPage(settings);
            wrapper.appendChild(coverDiv.firstElementChild);
        }
        
        // Add TOC if enabled
        if (settings.toc.enabled) {
            const tocDiv = document.createElement('div');
            tocDiv.innerHTML = this.generateTOC(clone, settings);
            tocDiv.firstElementChild.style.pageBreakAfter = 'always';
            wrapper.appendChild(tocDiv.firstElementChild);
        }
        
        // Add main content
        wrapper.appendChild(clone);
        
        return wrapper;
    }

    /**
     * Build the CSS driving Paged.js pagination — used both for the live
     * preview and for PDF export (see PagedPreviewRenderer.printToPDF):
     * @page size/margin, running header/footer margin boxes, page-break-
     * avoidance rules, and typography scaling. Unwrapped from `@media
     * print` since Paged.js paginates on screen too, and uses CSS margin
     * boxes for headers/footers rather than a backend print API's
     * headerTemplate/footerTemplate.
     * @param {Object} settings - Settings object (see SettingsManager.getDefaultSettings)
     * @returns {string} CSS text
     */
    buildPagedPreviewCSS(settings) {
        const margins = settings.margins || {};
        const top = margins.top ?? 20;
        const bottom = margins.bottom ?? 20;
        const left = margins.left ?? 20;
        const right = margins.right ?? 20;
        const pageSize = this.getPageSizeMM(settings.pageSize);

        let css = `
        @page {
            size: ${pageSize};
            margin: ${top}mm ${right}mm ${bottom}mm ${left}mm;
            ${this.buildRunningHeaderFooterCSS(settings)}
        }
        `;

        css += this.getPagedPageBreakCSS(settings);
        css += this.getPagedTypographyCSS(settings);
        css += this.getTOCStyles();

        return css;
    }

    /**
     * @param {Object} settings - Settings object (pageSize + margins)
     * @returns {string} Inline style declarations, e.g. "width: 210mm; ..."
     */
    getPreSourceInlineStyle(settings) {
        const margins = settings.margins || {};
        const top = margins.top ?? 20;
        const bottom = margins.bottom ?? 20;
        const left = margins.left ?? 20;
        const right = margins.right ?? 20;
        const { width } = this.getPageDimensionsMM(settings.pageSize);

        return `width: ${width}mm; box-sizing: border-box; padding: ${top}mm ${right}mm ${bottom}mm ${left}mm;`;
    }

    /**
     * Map a page size name to explicit CSS `size:` dimensions in mm.
     * Paged.js's @page size keyword parsing is unreliable (verified:
     * `size: a4` silently falls back to its Letter default, and `Legal`
     * isn't recognized either) — explicit physical dimensions sidestep it.
     * @param {string} pageSize - 'A4' | 'Letter' | 'Legal'
     * @returns {string} CSS size value, e.g. "210mm 297mm"
     */
    getPageSizeMM(pageSize) {
        const { width, height } = this.getPageDimensionsMM(pageSize);
        return `${width}mm ${height}mm`;
    }

    /**
     * Look up physical page dimensions in mm.
     * @param {string} pageSize - 'A4' | 'Letter' | 'Legal'
     * @returns {{width: number, height: number}}
     */
    getPageDimensionsMM(pageSize) {
        return PAGE_DIMENSIONS_MM[pageSize] || PAGE_DIMENSIONS_MM.A4;
    }

    /**
     * @param {Object} settings - Settings object (pageSize + margins)
     * @returns {number} Content height in mm
     */
    getPageContentHeightMM(settings) {
        const { height } = this.getPageDimensionsMM(settings.pageSize);
        const margins = settings.margins || {};
        const top = margins.top ?? 20;
        const bottom = margins.bottom ?? 20;
        return height - top - bottom - PAGE_FIT_SAFETY_MARGIN_MM;
    }

    /**
     * Build @top-center / @bottom-center margin box rules for headers/footers
     * @param {Object} settings - Settings object
     * @returns {string} CSS margin box declarations (no surrounding @page block)
     */
    buildRunningHeaderFooterCSS(settings) {
        let css = '';

        if (settings.headers?.enabled && settings.headers.template) {
            const content = this.templateToCSSContent(settings.headers.template, settings);
            css += `
            @top-center {
                content: ${content};
                font-size: 9pt;
                color: #4b5563;
            }`;
        }

        if (settings.footers?.enabled) {
            let template = settings.footers.template;
            if (!template && settings.footers.pageNumbers) {
                template = 'Page {page} of {total}';
            }
            if (template) {
                const content = this.templateToCSSContent(template, settings);
                css += `
            @bottom-center {
                content: ${content};
                font-size: 9pt;
                color: #4b5563;
            }`;
            }
        }

        return css;
    }

    /**
     * @param {string} template - Template with {title}/{author}/{date}/{page}/{total}
     * @param {Object} settings - Settings object (for metadata substitution)
     * @returns {string} CSS content value, e.g. `"Page " counter(page) " of " counter(pages)`
     */
    templateToCSSContent(template, settings) {
        let resolved = template
            .replace(/{title}/g, settings.metadata?.title || '')
            .replace(/{author}/g, settings.metadata?.author || '')
            .replace(/{date}/g, new Date().toLocaleDateString());

        // Split on {page}/{total}, keeping the delimiters
        const parts = resolved.split(/({page}|{total})/g).filter(p => p !== '');

        const segments = parts.map(part => {
            if (part === '{page}') return 'counter(page)';
            if (part === '{total}') return 'counter(pages)';
            return `"${part.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        });

        return segments.length ? segments.join(' ') : '""';
    }

    /**
     * Page-break-avoidance rules, unwrapped from `@media print` since
     * Paged.js paginates on screen, not print.
     * @param {Object} settings - Settings object (pageSize + margins), used
     *   to cap diagrams/images at one page's height - see the "unbreakable
     *   but oversized" note below.
     * @returns {string} CSS
     */
    getPagedPageBreakCSS(settings) {
        return `
        .cover-page, .table-of-contents {
            break-after: page;
        }
        h1, h2, h3, h4, h5, h6 {
            break-after: avoid;
            break-inside: avoid;
        }
        table, tr, pre, blockquote, .mermaid, svg, figure, .block-resize-wrapper {
            break-inside: avoid;
        }
        img {
            break-inside: avoid;
            max-width: 100%;
            height: auto;
        }
        li {
            break-inside: avoid;
        }
        h1 + *, h2 + *, h3 + *, h4 + *, h5 + *, h6 + * {
            break-before: avoid;
        }
        .cover-page h1, .cover-page h2,
        .table-of-contents h2 {
            break-after: auto;
            break-inside: auto;
        }
        .cover-page h1 + *, .cover-page h2 + *,
        .table-of-contents h2 + * {
            break-before: auto;
        }
        p {
            orphans: 3;
            widows: 3;
        }
        .preview-content {
            max-width: 100%;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: 100%;
        }
        .mermaid svg, img {
            max-height: ${this.getPageContentHeightMM(settings)}mm;
            width: auto;
            height: auto;
        }
        `;
    }

    /**
     * Typography-scaling CSS (font family/size/line-height overrides)
     * @param {Object} settings - Settings object
     * @returns {string} CSS
     */
    getPagedTypographyCSS(settings) {
        if (!settings.fontFamily && !settings.fontSize && !settings.lineHeight) {
            return '';
        }

        const headingExclusion = ':not(h1):not(h2):not(h3):not(h4):not(h5):not(h6)';
        let css = `.preview-content,\n.preview-content *:not(code):not(pre)${headingExclusion} {\n`;

        if (settings.fontFamily) {
            css += `    font-family: ${settings.fontFamily} !important;\n`;
        }
        if (settings.lineHeight) {
            css += `    line-height: ${settings.lineHeight} !important;\n`;
        }

        css += '}\n\n';

        if (settings.fontSize) {
            css += `.preview-content,\n.preview-content *:not(code):not(pre)${headingExclusion} {\n`;
            css += `    font-size: ${settings.fontSize}pt !important;\n`;
            css += '}\n';
        }

        return css;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * @returns {string} CSS for TOC
     */
    getTOCStyles() {
        return `
            .table-of-contents {
                padding: 2rem;
                margin-bottom: 2rem;
            }

            .toc-title {
                font-size: 2rem;
                font-weight: bold;
                margin-bottom: 1.5rem;
                color: #1f2937;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 0.5rem;
            }

            .toc-list {
                list-style: none;
                padding: 0;
            }

            .toc-list li {
                margin: 0.5rem 0;
            }

            .toc-link {
                color: #2563eb;
                text-decoration: none;
                transition: color 0.2s;
            }

            .toc-link:hover {
                color: #1d4ed8;
                text-decoration: underline;
            }

            .toc-level-0 {
                padding-left: 0;
                font-weight: 600;
            }

            .toc-level-1 {
                padding-left: 1.5rem;
                font-weight: 500;
            }

            .toc-level-2 {
                padding-left: 3rem;
            }

            .toc-level-3 {
                padding-left: 4.5rem;
            }

            .toc-level-4 {
                padding-left: 6rem;
            }

            .toc-level-5 {
                padding-left: 7.5rem;
            }
        `;
    }
}
