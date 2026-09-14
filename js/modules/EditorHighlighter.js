/**
 * EditorHighlighter Module
 * VS Code-like syntax highlighting for the raw markdown editor.
 */

export class EditorHighlighter {
    static INLINE_RE = /(?<codeMark>`+)(?<code>[^`]+?)\k<codeMark>|(?<linkOpen>\[)(?<linkText>[^\]]*)(?<linkMid>\]\()(?<linkUrl>[^)]*)(?<linkClose>\))|(?<boldMark>\*\*|__)(?<bold>[^*_]+?)\k<boldMark>|(?<italicMark>\*|_)(?<italic>[^*_]+?)\k<italicMark>/g;

    constructor(textarea, overlay) {
        this.textarea = textarea;
        this.overlay = overlay;
    }

    /**
     * Re-render the overlay to match the textarea's current content.
     */
    update() {
        this.overlay.innerHTML = this.highlight(this.textarea.value);
        this.syncScroll();
    }

    /**
     * Mirror the textarea's scroll position onto the overlay
     */
    syncScroll() {
        this.overlay.scrollTop = this.textarea.scrollTop;
        this.overlay.scrollLeft = this.textarea.scrollLeft;
    }

    /**
     * Build the highlighted HTML for a full markdown document.
     * @param {string} text
     * @returns {string} HTML
     */
    highlight(text) {
        const lines = text.split('\n');
        const chunks = [];
        let fence = null; 

        for (const line of lines) {
            const fenceMatch = line.match(/^(\s*)(```)(\w*)\s*$/);

            if (fenceMatch) {
                if (fence) {
                    if (fence.buffer.length > 0) {
                        chunks.push(this.highlightFenceBody(fence));
                    }
                    chunks.push(`<span class="md-marker md-fence">${this.escapeHtml(line)}</span>`);
                    fence = null;
                } else {
                    // Opening fence
                    chunks.push(`<span class="md-marker md-fence">${this.escapeHtml(line)}</span>`);
                    fence = { lang: fenceMatch[3], buffer: [] };
                }
                continue;
            }

            if (fence) {
                fence.buffer.push(line);
                continue;
            }

            chunks.push(this.highlightLine(line));
        }

        if (fence && fence.buffer.length > 0) {
            chunks.push(this.highlightFenceBody(fence));
        }

        let html = chunks.join('\n');

        if (text.endsWith('\n')) {
            html += '​';
        }

        return html;
    }

    /**
     * Highlight one non-fence, non-blockquote-continuation source line:
     * block-level prefix (heading/blockquote/list marker) if any, then
     * inline formatting on the remainder.
     * @param {string} line - Raw (unescaped) source line
     * @returns {string} HTML
     */
    highlightLine(line) {
        const headingMatch = line.match(/^(#{1,6})(\s+)(.*)$/);
        if (headingMatch) {
            const [, hashes, spaces, rest] = headingMatch;
            return `<span class="md-marker">${this.escapeHtml(hashes)}</span>${this.escapeHtml(spaces)}`
                + `<span class="md-heading md-h${hashes.length}">${this.highlightInline(rest)}</span>`;
        }

        const quoteMatch = line.match(/^(\s*>\s?)(.*)$/);
        if (quoteMatch) {
            const [, marker, rest] = quoteMatch;
            return `<span class="md-marker md-quote-marker">${this.escapeHtml(marker)}</span>`
                + `<span class="md-quote">${this.highlightInline(rest)}</span>`;
        }

        const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/);
        if (listMatch) {
            const [, indent, marker, spaces, rest] = listMatch;
            return `${this.escapeHtml(indent)}<span class="md-marker">${this.escapeHtml(marker)}</span>`
                + `${this.escapeHtml(spaces)}${this.highlightInline(rest)}`;
        }

        return this.highlightInline(line);
    }

    /**
     * Apply inline formatting (code spans, links, bold, italic) to a raw
     * (unescaped) line/fragment - as a single combined-alternation regex
     * pass, not several independent chained .replace() calls.
     * @param {string} text - Raw source text
     * @returns {string} HTML
     */
    highlightInline(text) {
        const escaped = this.escapeHtml(text);

        return escaped.replace(EditorHighlighter.INLINE_RE, (match, ...rest) => {
            const groups = rest[rest.length - 1];

            if (groups.codeMark) {
                return `<span class="md-marker">${groups.codeMark}</span><span class="md-code">${groups.code}</span><span class="md-marker">${groups.codeMark}</span>`;
            }
            if (groups.linkOpen) {
                return `<span class="md-marker">${groups.linkOpen}</span><span class="md-link-text">${groups.linkText}</span>`
                    + `<span class="md-marker">${groups.linkMid}</span><span class="md-link-url">${groups.linkUrl}</span>`
                    + `<span class="md-marker">${groups.linkClose}</span>`;
            }
            if (groups.boldMark) {
                return `<span class="md-marker">${groups.boldMark}</span><span class="md-bold">${groups.bold}</span><span class="md-marker">${groups.boldMark}</span>`;
            }
            if (groups.italicMark) {
                return `<span class="md-marker">${groups.italicMark}</span><span class="md-italic">${groups.italic}</span><span class="md-marker">${groups.italicMark}</span>`;
            }
            return match;
        });
    }

    /**
     * Highlight a fenced code block's body as one multi-line unit, via
     * highlight.js (already loaded for the rendered preview) when a
     * language is available, falling back to plain escaped text otherwise.
     * @param {{lang: string, buffer: string[]}} fence
     * @returns {string} HTML (containing the same number of embedded \n as
     *   fence.buffer.length - 1)
     */
    highlightFenceBody(fence) {
        const code = fence.buffer.join('\n');
        if (code === '') return '';

        if (window.hljs) {
            try {
                if (fence.lang && window.hljs.getLanguage(fence.lang)) {
                    return `<span class="md-code-block">${window.hljs.highlight(code, { language: fence.lang, ignoreIllegals: true }).value}</span>`;
                }
                return `<span class="md-code-block">${window.hljs.highlightAuto(code).value}</span>`;
            } catch (error) {
                console.error('EditorHighlighter: highlight.js error', error);
            }
        }

        return `<span class="md-code-block">${this.escapeHtml(code)}</span>`;
    }

    /**
     * Escape HTML special characters without altering any other character.
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
