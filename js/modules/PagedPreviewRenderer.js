/**
 * PagedPreviewRenderer Module
 * Live, in-browser paginated preview using Paged.js
 */

import { applyStoredScales } from './BlockResizer.js';
import { extractBlockSizes } from './BlockSizeParser.js';
import { getCodeTheme } from './codeThemeRegistry.js';
import { GOOGLE_FONTS_URL } from './webFonts.js';

const RENDER_TIMEOUT_MS = 15000;

// CSS px per mm at the standard 96dpi CSS reference resolution (96/25.4).
const PX_PER_MM = 96 / 25.4;

export class PagedPreviewRenderer {
    constructor(mermaidRenderer, documentStructure, mathRenderer = null) {
        this.mermaidRenderer = mermaidRenderer;
        this.documentStructure = documentStructure;
        this.mathRenderer = mathRenderer;
        this.iframe = null;
        this.wrapper = null;
        this.renderToken = 0;
        this.pageWidthPx = null;
        this.currentScale = 1;

        this.onAnchorNavigate = null;

        window.addEventListener('message', (event) => {
            if (!event.data || event.data.source !== 'paged-preview-anchor') return;
            if (!this.iframe || event.source !== this.iframe.contentWindow) return;

            this.scrollToAnchor(event.data.id);
            if (event.data.lineStart != null) {
                this.onAnchorNavigate?.(event.data.lineStart);
            }
        });
    }

    /**
     * @param {string} id - Heading element id to scroll to
     */
    scrollToAnchor(id) {
        const doc = this.iframe?.contentDocument;
        const targetElement = this.wrapper?.parentElement;
        if (!doc || !targetElement) return;

        const target = doc.getElementById(id);
        if (!target) return;

        const offsetTop = target.getBoundingClientRect().top - doc.body.getBoundingClientRect().top;
        targetElement.scrollTo({ top: Math.max(0, offsetTop * this.currentScale), behavior: 'smooth' });
    }

    /**
     * Build the paginated document's content HTML + dynamic CSS from
     * markdown
     * @param {string} markdown - Markdown source
     * @param {Renderer} renderer - Renderer instance (markdown -> HTML)
     * @param {string} theme - Theme name
     * @param {Object} settings - Settings object (see SettingsManager.getDefaultSettings)
     * @returns {Promise<{contentString: string, css: string, pageWidthPx: number, blockList: Array, preSourceStyle: string}>}
     */
    async buildDocument(markdown, renderer, theme, settings) {
        // Markdown -> HTML (resolves image references)
        const html = await renderer.render(markdown);

        // Assemble cover page + TOC + content in a detached wrapper
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = html;
        const wrapper = this.documentStructure.prepareContent(contentDiv, settings);

        // Pre-render Mermaid diagrams to SVG *before* pagination
        await this.mermaidRenderer.renderDiagrams(wrapper);

        // Pre-render LaTeX/KaTeX math the same way, before pagination
        this.mathRenderer?.renderMath(wrapper);

        const contentString = `<div class="preview-content" data-theme="${theme}">${wrapper.innerHTML}</div>`;
        const css = this.documentStructure.buildPagedPreviewCSS(settings);

        const pageWidthPx = this.documentStructure.getPageDimensionsMM(settings.pageSize).width * PX_PER_MM;

        const blockList = extractBlockSizes(markdown);

        const preSourceStyle = this.documentStructure.getPreSourceInlineStyle(settings);

        return { contentString, css, pageWidthPx, blockList, preSourceStyle };
    }

    /**
     * Render markdown as a live paginated preview into targetElement.
     * @param {string} markdown - Markdown source
     * @param {Renderer} renderer - Renderer instance (markdown -> HTML)
     * @param {string} theme - Theme name
     * @param {Object} settings - Settings object (see SettingsManager.getDefaultSettings)
     * @param {HTMLElement} targetElement - Container to hold the preview iframe
     * @param {string} [codeTheme] - Code block theme name (see codeThemeRegistry.js); 'default' means no override
     * @returns {Promise<number>} Total page count
     */
    async render(markdown, renderer, theme, settings, targetElement, codeTheme = 'default') {
        const { contentString, css, pageWidthPx, blockList, preSourceStyle } = await this.buildDocument(markdown, renderer, theme, settings);
        this.pageWidthPx = pageWidthPx;

        const iframe = this.ensureIframe(targetElement);
        const token = ++this.renderToken;

        const total = await this.renderInIframe(iframe, token, contentString, css, theme, blockList, preSourceStyle, codeTheme);
        this.scaleToFit(iframe, targetElement);
        return total;
    }

    /**
     * Render markdown as a print-ready paginated document in a detached,
     * off-screen iframe and invoke the browser's native print dialog
     * against it. 
     * @param {string} markdown - Markdown source
     * @param {Renderer} renderer - Renderer instance (markdown -> HTML)
     * @param {string} theme - Theme name
     * @param {Object} settings - Settings object (see SettingsManager.getDefaultSettings)
     * @param {string} filename - Suggested filename (sans extension)
     * @param {string} [codeTheme] - Code block theme name (see codeThemeRegistry.js); 'default' means no override
     * @returns {Promise<void>} Resolves once the print dialog has been
     *   invoked — browsers give no callback for the user finishing/cancelling it.
     */
    async printToPDF(markdown, renderer, theme, settings, filename = 'document', codeTheme = 'default') {
        const { contentString, css, pageWidthPx, blockList, preSourceStyle } = await this.buildDocument(markdown, renderer, theme, settings);
        const pageSizeMM = this.documentStructure.getPageSizeMM(settings.pageSize);

        const iframe = document.createElement('iframe');
        iframe.style.cssText = `position: fixed; top: 0; left: -10000px; width: ${pageWidthPx}px; height: 500px; border: 0;`;
        document.body.appendChild(iframe);

        const token = ++this.renderToken;
        try {
            await this.renderInIframe(iframe, token, contentString, css, theme, blockList, preSourceStyle, codeTheme, { print: true, pageSizeMM });
        } catch (error) {
            iframe.remove();
            throw error;
        }

        iframe.contentDocument.title = filename;

        const cleanup = () => iframe.remove();
        iframe.contentWindow.addEventListener('afterprint', cleanup, { once: true });

        setTimeout(cleanup, 5 * 60 * 1000);

        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }

    /**
     * Get or create the preview iframe inside targetElement, wrapped in a
     * clipping box that scaleToFit() sizes to the visible (scaled) footprint.
     * @param {HTMLElement} targetElement - Container element
     * @returns {HTMLIFrameElement}
     */
    ensureIframe(targetElement) {
        if (this.iframe && this.wrapper && this.wrapper.parentElement === targetElement) {
            return this.iframe;
        }

        targetElement.innerHTML = '';

        const wrapperEl = document.createElement('div');
        wrapperEl.className = 'paged-preview-wrapper';
        wrapperEl.style.cssText = 'overflow: hidden; margin: 0 auto;';

        const iframe = document.createElement('iframe');
        iframe.className = 'paged-preview-frame';
        iframe.style.cssText = 'display: block; border: none; transform-origin: top left;';

        iframe.setAttribute('scrolling', 'no');

        wrapperEl.appendChild(iframe);
        targetElement.appendChild(wrapperEl);
        this.iframe = iframe;
        this.wrapper = wrapperEl;

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.resizeObserver = new ResizeObserver(() => this.scaleToFit(iframe, targetElement));
        this.resizeObserver.observe(targetElement);

        return iframe;
    }

    /**
     * @param {HTMLIFrameElement} iframe
     * @param {HTMLElement} targetElement - Panel the iframe lives in
     */
    scaleToFit(iframe, targetElement) {
        const doc = iframe.contentDocument;
        const body = doc?.body;
        if (!body) return;

        const naturalWidth = this.pageWidthPx;

        const naturalHeight = Math.max(body.scrollHeight, body.offsetHeight);
        if (!naturalWidth || !naturalHeight) return;

        iframe.style.width = `${naturalWidth}px`;
        iframe.style.height = `${naturalHeight}px`;

        const targetStyle = getComputedStyle(targetElement);
        const availableWidth = targetElement.clientWidth
            - parseFloat(targetStyle.paddingLeft)
            - parseFloat(targetStyle.paddingRight)
            - 1;
        const scale = availableWidth > 0 ? Math.min(1, availableWidth / naturalWidth) : 1;

        this.currentScale = scale;

        iframe.style.transform = `scale(${scale})`;

        this.wrapper.style.width = `${Math.floor(naturalWidth * scale)}px`;
        this.wrapper.style.height = `${Math.floor(naturalHeight * scale)}px`;
    }

    /**
     * Write a self-contained HTML document into the iframe and wait for
     * Paged.js (loaded fresh inside that document) to finish paginating.
     * @param {HTMLIFrameElement} iframe
     * @param {number} token - Render token to ignore stale/superseded results
     * @param {string} contentString - Content HTML (already wrapped in .preview-content)
     * @param {string} css - Dynamic @page/typography/page-break CSS
     * @param {string} theme - Theme name (resolves css/themes/<theme>.css)
     * @param {Array} blockList - From BlockSizeParser.extractBlockSizes(), see buildIframeHTML
     * @param {string} preSourceStyle - From DocumentStructure.getPreSourceInlineStyle(), see buildIframeHTML
     * @param {string} [codeTheme] - Code block theme name, see buildIframeHTML
     * @param {Object} [printOptions] - See buildIframeHTML
     * @returns {Promise<number>} Total page count
     */
    renderInIframe(iframe, token, contentString, css, theme, blockList, preSourceStyle, codeTheme, printOptions) {
        return new Promise((resolve, reject) => {
            let settled = false;

            const timeoutId = setTimeout(() => {
                if (settled || token !== this.renderToken) return;
                settled = true;
                window.removeEventListener('message', onMessage);
                reject(new Error('Paged.js preview timed out'));
            }, RENDER_TIMEOUT_MS);

            const onMessage = (event) => {
                if (!event.data || event.data.source !== 'paged-preview') return;
                if (event.source !== iframe.contentWindow) return;
                if (settled || token !== this.renderToken) return;

                settled = true;
                clearTimeout(timeoutId);
                window.removeEventListener('message', onMessage);

                if (event.data.ok) {
                    resolve(event.data.total);
                } else {
                    reject(new Error(event.data.error || 'Paged.js preview failed'));
                }
            };

            window.addEventListener('message', onMessage);

            const html = this.buildIframeHTML(contentString, css, theme, blockList, preSourceStyle, codeTheme, printOptions);
            const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
            iframe.addEventListener('load', () => URL.revokeObjectURL(blobUrl), { once: true });
            iframe.src = blobUrl;
        });
    }

    /**
     * Build the standalone HTML document rendered inside the iframe.
     * @param {string} contentString - Content HTML
     * @param {string} css - Dynamic CSS
     * @param {string} theme - Theme name
     * @param {Array} blockList - From BlockSizeParser.extractBlockSizes()
     * @param {Object} [printOptions] - When set, this iframe is the
     *   dedicated off-screen document built for printToPDF()
     * @param {string} preSourceStyle - From
     *   DocumentStructure.getPreSourceInlineStyle() - applied as a real
     *   inline style directly on #paged-preview-source below
     * @param {Object} [printOptions] - When set, this iframe is the
     *   dedicated off-screen document built for printToPDF() rather than
     *   the on-screen live preview: adds a real (non-Paged.js) `@page`
     *   rule matching the physical page size, and strips the screen-only
     *   preview decorations (page-divider chip, drop shadow, page gap) so
     *   they don't show up in the printed/saved PDF.
     * @param {string} [printOptions.pageSizeMM] - like "210mm 297mm"
     * @param {string} [codeTheme] - Code block theme name
     * @returns {string} HTML document
     */
    buildIframeHTML(contentString, css, theme, blockList, preSourceStyle, codeTheme, printOptions) {
        const codeThemeEntry = codeTheme && codeTheme !== 'default' ? getCodeTheme(codeTheme) : null;
        const hljsStylesheetUrl = codeThemeEntry?.hljsUrl || 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css';
        const bodyClass = codeThemeEntry ? `theme-${theme} code-theme-${codeTheme}` : `theme-${theme}`;
        const printCSS = printOptions ? `

@page { size: ${printOptions.pageSizeMM}; margin: 0; }
html, body { margin: 0; padding: 0; background: none; }
.pagedjs_page {
    /* Each box is already sized to exactly one physical page — force the
       browser's native pagination to break between boxes, never inside
       one, so it can't re-slice content Paged.js already laid out. */
    break-after: page;
    break-inside: avoid;
    box-shadow: none;
    margin: 0;
}
.pagedjs-page-divider { display: none; }
` : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
/* Browser default body margin isn't part of the @page box Paged.js lays
   pages out against, so left unreset it pushes each page 8px past the
   iframe's own (page-width-sized) viewport — the page's right edge silently
   gets clipped instead of scaled to fit. */
html, body { margin: 0; padding: 0; }

body { padding: 12px 0; }
.pagedjs_page {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    margin: 0 auto 8px auto;
}
.pagedjs-page-divider {
    width: fit-content;
    margin: 0 auto 8px auto;
    font: bold 11px 'MS Sans Serif', 'Microsoft Sans Serif', Tahoma, Arial, sans-serif;
    color: #ffffff;
    background: #000080;
    border: 1px solid #ffffff;
    padding: 2px 10px;
    white-space: nowrap;
}
${printCSS}</style>
<script>window.PagedConfig = { auto: false };</script>
<script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
<link rel="stylesheet" href="${hljsStylesheetUrl}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<link rel="stylesheet" href="${GOOGLE_FONTS_URL}">
<link rel="stylesheet" href="css/themes/${theme}.css">
<link rel="stylesheet" href="css/code-block-themes.css">
<script type="text/plain" id="dynamic-css">${css}</script>
<script>
// See buildIframeHTML's blockList doc comment for why this is inlined
// as a plain function body rather than imported as a module.
const applyStoredScales = ${applyStoredScales.toString()};
const blockList = ${JSON.stringify(blockList || [])};
</script>
</head>
<body class="${bodyClass}">
<div id="paged-preview-source" style="${preSourceStyle}">${contentString}</div>
<script>
document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    event.preventDefault();
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    if (!id) return;

    const target = document.getElementById(id);
    if (!target) return;

    parent.postMessage({
        source: 'paged-preview-anchor',
        id,
        lineStart: target.dataset.lineStart ? parseInt(target.dataset.lineStart, 10) : null
    }, '*');
});

(function poll() {
    if (window.Paged && window.Paged.Previewer) {
        const source = document.getElementById('paged-preview-source');
        applyStoredScales(source, blockList);
        const html = source.innerHTML;
        source.remove();

        const cssText = document.getElementById('dynamic-css').textContent;
        const cssBlobUrl = URL.createObjectURL(new Blob([cssText], { type: 'text/css' }));

        new window.Paged.Previewer().preview(html, [cssBlobUrl], document.body).then((flow) => {
            const pages = document.querySelectorAll('.pagedjs_page');
            pages.forEach((pageEl, i) => {
                const divider = document.createElement('div');
                divider.className = 'pagedjs-page-divider';
                divider.textContent = 'Page ' + (i + 1) + ' of ' + flow.total;
                pageEl.insertAdjacentElement('afterend', divider);
            });
            parent.postMessage({ source: 'paged-preview', ok: true, total: flow.total }, '*');
        }).catch((error) => {
            parent.postMessage({ source: 'paged-preview', ok: false, error: error.message }, '*');
        });
    } else {
        setTimeout(poll, 50);
    }
})();
</script>
</body>
</html>`;
    }
}
