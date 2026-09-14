/**
 * Renderer Module
 * Handles markdown rendering to HTML with image resolution
 */

export class Renderer {
    constructor(imageManager = null) {
        this.md = null;
        this.imageManager = imageManager;
        this.init();
    }

    /**
     * Initialize markdown-it with plugins and options
     */
    init() {
        if (typeof window.markdownit === 'undefined') {
            console.error('markdown-it library not loaded');
            return;
        }

        // Initialize markdown-it with options
        this.md = window.markdownit({
            html: true,
            linkify: true,
            typographer: true,
            breaks: false,
            
            // Syntax highlighting for code blocks
            highlight: (str, lang) => {
                if (lang && window.hljs && window.hljs.getLanguage(lang)) {
                    try {
                        return `<pre><code class="hljs language-${lang}">` +
                               window.hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                               '</code></pre>';
                    } catch (err) {
                        console.error('Syntax highlighting error:', err);
                    }
                }
                return `<pre><code class="hljs">${this.escapeHtml(str)}</code></pre>`;
            }
        });
        
        // Add line number attributes to rendered elements for scroll sync
        this.addLineNumberRenderer();

        // Open links in a new tab instead of navigating the app away
        this.addLinkTargetRenderer();

        // Give every heading a stable, GitHub-style slug id
        this.addHeadingIdRenderer();
    }

    addHeadingIdRenderer() {
        const defaultRender = this.md.renderer.rules.heading_open ||
            ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

        this.md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const inlineToken = tokens[idx + 1];
            const text = inlineToken && inlineToken.type === 'inline' ? inlineToken.content : '';
            const slug = this.slugifyHeading(text, env);

            if (slug) {
                token.attrSet('id', slug);
            }

            return defaultRender(tokens, idx, options, env, self);
        };
    }

    /**
     * Turn heading text into a GitHub-style slug
     * @param {string} text - Heading's plain-text content
     * @param {object} env - markdown-it's per-render environment object
     * @returns {string} Slug, or '' for a heading with no usable text
     */
    slugifyHeading(text, env) {
        const base = text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        if (!base) {
            return '';
        }

        env.usedHeadingSlugs = env.usedHeadingSlugs || new Map();
        const count = env.usedHeadingSlugs.get(base) || 0;
        env.usedHeadingSlugs.set(base, count + 1);

        return count === 0 ? base : `${base}-${count}`;
    }

    addLinkTargetRenderer() {
        const defaultRender = this.md.renderer.rules.link_open ||
            ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

        this.md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const href = token.attrGet('href') || '';

            if (!href.startsWith('#')) {
                token.attrSet('target', '_blank');
                token.attrSet('rel', 'noopener noreferrer');
            }

            return defaultRender(tokens, idx, options, env, self);
        };
    }
    
    addLineNumberRenderer() {
        // Store original renderer rules
        const defaultRender = this.md.renderer.rules;
        
        // List of block-level tokens to add line numbers to
        const blockTokens = [
            'paragraph_open', 'heading_open', 'blockquote_open',
            'code_block', 'fence', 'hr', 'bullet_list_open',
            'ordered_list_open', 'list_item_open', 'table_open'
        ];
        
        // Override renderer for each block token
        blockTokens.forEach(tokenType => {
            const originalRule = defaultRender[tokenType] || this.md.renderer.renderToken.bind(this.md.renderer);
            
            this.md.renderer.rules[tokenType] = (tokens, idx, options, env, self) => {
                const token = tokens[idx];
                
                // Add line number attributes if token has source map
                if (token.map && token.map.length >= 2) {
                    const startLine = token.map[0] + 1; // Convert 0-based to 1-based
                    const endLine = token.map[1]; // Already 1-based (exclusive end)
                    
                    // Ensure token has attrs array
                    if (!token.attrs) {
                        token.attrs = [];
                    }
                    
                    // Add data attributes
                    token.attrPush(['data-line-start', String(startLine)]);
                    token.attrPush(['data-line-end', String(endLine)]);
                }
                
                // Render using original rule or default
                if (typeof originalRule === 'function') {
                    return originalRule(tokens, idx, options, env, self);
                }
                return self.renderToken(tokens, idx, options);
            };
        });
    }

    /**
     * Extract mermaid code blocks and replace with placeholders
     * @param {string} markdown - Original markdown
     * @returns {object} Processed markdown and extracted blocks
     */
    extractMermaidBlocks(markdown) {
        const mermaidBlocks = [];
        let blockIndex = 0;

        const processedMarkdown = markdown.replace(/```mermaid\n([\s\S]*?)```/g, (match, code, offset) => {
            const startLine = markdown.slice(0, offset).split('\n').length;
            const lineCount = match.split('\n').length;
            const endLine = startLine + lineCount - 1;

            const placeholder = `<!--MERMAID_BLOCK_${blockIndex}-->`;
            mermaidBlocks.push({
                placeholder,
                code: code.trim(),
                index: blockIndex,
                startLine,
                endLine
            });
            blockIndex++;
            return placeholder + '\n'.repeat(lineCount - 1);
        });

        return { processedMarkdown, mermaidBlocks };
    }

    /**
     * Restore mermaid blocks as divs with special class
     * @param {string} html - Rendered HTML
     * @param {array} mermaidBlocks - Extracted mermaid blocks
     * @returns {string} HTML with mermaid divs
     */
    restoreMermaidBlocks(html, mermaidBlocks) {
        let processedHtml = html;

        mermaidBlocks.forEach(block => {
            const mermaidDiv = `<div class="mermaid" data-processed="false" data-line-start="${block.startLine}" data-line-end="${block.endLine}">${block.code}</div>`;
            processedHtml = processedHtml.replace(
                new RegExp(`<p>${block.placeholder}</p>`, 'g'),
                mermaidDiv
            );
            processedHtml = processedHtml.replace(
                new RegExp(block.placeholder, 'g'),
                mermaidDiv
            );
        });

        return processedHtml;
    }

    sanitizeHtml(html) {
        if (typeof window.DOMPurify === 'undefined') {
            console.error('DOMPurify not loaded, rendering unsanitized HTML');
            return html;
        }

        return window.DOMPurify.sanitize(html);
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
     * Escape text for safe use inside a double-quoted HTML attribute value.
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeAttr(text) {
        return this.escapeHtml(text).replace(/"/g, '&quot;');
    }

    /**
     * Count words in text
     * @param {string} text - Text to count
     * @returns {number} Word count
     */
    countWords(text) {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Render markdown to HTML
     * @param {string} markdown - Markdown text to render
     * @returns {Promise<string>} Rendered HTML
     */
    async render(markdown) {
        if (!markdown || typeof markdown !== 'string') {
            return '';
        }

        try {
            // Extract mermaid code blocks so markdown-it doesn't render them
            // as plain code blocks; restore them as diagram placeholders after
            const { processedMarkdown, mermaidBlocks } = this.extractMermaidBlocks(markdown);

            // Resolve image references before rendering
            const resolvedMarkdown = await this.resolveImageReferences(processedMarkdown);

            const html = this.md.render(resolvedMarkdown);

            return this.sanitizeHtml(this.restoreMermaidBlocks(html, mermaidBlocks));
        } catch (error) {
            console.error('Markdown rendering error:', error);
            return '<p class="error">Failed to render markdown</p>';
        }
    }

    /**
     * Resolve image references in markdown
     * Replaces both image:id and file path references with base64 data
     * @param {string} markdown - Markdown text
     * @returns {Promise<string>} Markdown with resolved image references
     */
    async resolveImageReferences(markdown) {
        if (!this.imageManager) {
            return markdown;
        }

        try {
            // Find all image references
            const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
            let match;
            const replacements = [];

            while ((match = imageRegex.exec(markdown)) !== null) {
                const altText = match[1];
                const imagePath = match[2];
                const fullMatch = match[0];

                if (imagePath.startsWith('image:')) {
                    const ref = imagePath.substring(6); // Remove 'image:' prefix
                    const widthMatch = ref.match(/^(.+):(\d+)$/);
                    const imageId = widthMatch ? widthMatch[1] : ref;
                    const width = widthMatch ? widthMatch[2] : null;
                    const image = await this.imageManager.getImage(imageId);

                    if (image) {
                        const widthAttr = width ? ` width="${width}"` : '';
                        replacements.push({
                            original: fullMatch,
                            replacement: `<img src="${image.data}" alt="${this.escapeAttr(altText)}" data-image-id="${imageId}"${widthAttr}>`
                        });
                    }
                }
                // Check if this is a file path that might match a stored image
                else {
                    const matches = await this.imageManager.findMatchingImages(markdown);
                    
                    for (const [path, imageId] of matches.entries()) {
                        if (path === imagePath) {
                            const image = await this.imageManager.getImage(imageId);
                            
                            if (image) {
                                replacements.push({
                                    original: fullMatch,
                                    replacement: `![${altText}](${image.data})`
                                });
                            }
                            break;
                        }
                    }
                }
            }

            // Apply all replacements
            let resolvedMarkdown = markdown;
            for (const { original, replacement } of replacements) {
                resolvedMarkdown = resolvedMarkdown.replace(original, replacement);
            }

            return resolvedMarkdown;
        } catch (error) {
            console.error('Error resolving image references:', error);
            return markdown; // Return original on error
        }
    }
}
