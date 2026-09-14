/**
 * TocPanel Module
 */

export class TocPanel {
    constructor(editor, renderer, documentStructure) {
        this.editor = editor;
        this.renderer = renderer;
        this.documentStructure = documentStructure;
        this.panel = null;
        this.overlay = null;
        this.isOpen = false;

        this.init();
    }

    /**
     * Initialize the TOC panel
     */
    init() {
        this.createPanel();
        this.setupEventListeners();
    }

    /**
     * Create the TOC panel DOM structure
     */
    createPanel() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'toc-panel-overlay';
        this.overlay.className = 'toc-panel-overlay';
        this.overlay.style.display = 'none';
        document.body.appendChild(this.overlay);

        this.panel = document.createElement('div');
        this.panel.id = 'toc-panel';
        this.panel.className = 'toc-panel';
        this.panel.innerHTML = `
            <div class="toc-panel-header">
                <h2>📑 Table of Contents</h2>
                <button class="toc-panel-close" aria-label="Close table of contents">×</button>
            </div>
            <div class="toc-panel-content">
                <ul class="toc-panel-list" id="toc-panel-list"></ul>
            </div>
        `;

        document.body.appendChild(this.panel);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        this.panel.querySelector('.toc-panel-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());
    }

    /**
     * Re-parse the current markdown (independently of whichever preview mode
     * is active) and extract its heading outline.
     * @returns {Promise<Array>} Heading objects with level/text/line
     */
    async buildHeadings() {
        const markdown = this.editor.getContent();
        const html = await this.renderer.render(markdown);

        const container = document.createElement('div');
        container.innerHTML = html;

        const headings = this.documentStructure.extractHeadings(container, 6);

        const headingElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        return headings.map((heading, index) => ({
            ...heading,
            line: parseInt(headingElements[index]?.dataset.lineStart, 10) || 1
        }));
    }

    /**
     * Render the heading list into the panel
     * @param {Array} headings
     */
    renderList(headings) {
        const list = this.panel.querySelector('#toc-panel-list');

        if (headings.length === 0) {
            list.innerHTML = '<li class="toc-panel-empty">No headings yet</li>';
            return;
        }

        list.innerHTML = headings.map((heading, index) => `
            <li class="toc-panel-item toc-level-${heading.level - 1}">
                <button class="toc-panel-link" data-line="${heading.line}" data-anchor="${this.escapeHtml(heading.id)}">${this.escapeHtml(heading.text)}</button>
            </li>
        `).join('');

        list.querySelectorAll('.toc-panel-link').forEach(link => {
            link.addEventListener('click', () => {
                const line = parseInt(link.dataset.line, 10);
                const anchor = link.dataset.anchor;
                this.editor.scrollToLineCentered(line);
                this.editor.scrollPreviewToHeading(anchor);
                this.close();
            });
        });
    }

    /**
     * Escape HTML special characters
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Open the TOC panel
     */
    async open() {
        this.isOpen = true;
        this.panel.classList.add('open');
        this.overlay.style.display = 'block';

        const headings = await this.buildHeadings();
        this.renderList(headings);
    }

    /**
     * Close the TOC panel
     */
    close() {
        this.isOpen = false;
        this.panel.classList.remove('open');
        this.overlay.style.display = 'none';
    }

    /**
     * Toggle the TOC panel
     */
    async toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            await this.open();
        }
    }
}
