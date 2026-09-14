/**
 * Editor Module
 * Handles the markdown editor and live preview functionality
 */

import { ImageResizer } from './ImageResizer.js';
import { BlockResizer } from './BlockResizer.js';
import { extractBlockSizes } from './BlockSizeParser.js';
import { EditorHighlighter } from './EditorHighlighter.js';
import { LineNumbers } from './LineNumbers.js';
import { FindReplace } from './FindReplace.js';
import { ScrollSync } from './ScrollSync.js';
import * as Storage from './Storage.js';

const PX_PER_MM = 96 / 25.4;

export class Editor {
    constructor(renderer, mermaidRenderer, documentStructure = null, settingsManager = null, mathRenderer = null) {
        this.renderer = renderer;
        this.mermaidRenderer = mermaidRenderer;
        this.documentStructure = documentStructure;
        this.settingsManager = settingsManager;
        this.mathRenderer = mathRenderer;
        this.textarea = null;
        this.previewContainer = null;
        this.wordCountElement = null;
        this.charCountElement = null;
        this.debounceTimer = null;
        this.debounceDelay = 300; 
        this.previewMode = 'simple';
        this.autoSaveTimer = null;
        this.autoSaveDelay = 2000;
        this.lineNumbers = new LineNumbers(this);
        this.findReplace = new FindReplace(this);
        this.scrollSync = new ScrollSync(this);

        this.imageResizer = new ImageResizer(this);

        this.blockResizer = new BlockResizer(this);

        this.simplePreviewResizeObserver = null;
        this.simplePreviewScale = 1;

        this.init();
    }

    /**
     * Initialize the editor
     */
    init() {
        // Get DOM elements
        this.textarea = document.getElementById('markdown-editor');
        this.previewContainer = document.getElementById('preview-content');
        this.wordCountElement = document.getElementById('word-count');

        if (!this.textarea || !this.previewContainer) {
            console.error('Editor elements not found');
            return;
        }

        // Load preview mode from localStorage
        this.loadPreviewMode();

        // Set up the raw-markdown syntax highlight overlay
        this.initHighlighter();

        // Set up event listeners
        this.setupEventListeners();

        // Ease wheel-scrolling instead of the browser's default large,
        this.setupSmoothWheelScroll(this.textarea);
        this.setupSmoothWheelScroll(this.previewContainer);

        // Handle clicks on in-document anchor links (`[text](#heading-slug)`)
        // inside the simple preview
        this.setupAnchorLinkHandling();

        // Initial render (even if empty)
        this.updatePreview();
    }

    /**
     * Wire up the syntax-highlight overlay.
     */
    initHighlighter() {
        const overlay = document.getElementById('markdown-editor-highlight');
        const wrapper = this.textarea.closest('.markdown-editor-wrapper');
        if (!overlay || !wrapper) {
            console.warn('Editor highlight overlay not found - raw markdown highlighting disabled');
            return;
        }

        this.highlighter = new EditorHighlighter(this.textarea, overlay);

        try {
            this.highlighter.update();
            wrapper.classList.add('highlighting-enabled');
        } catch (error) {
            console.error('Editor highlighter failed to initialize:', error);
            this.highlighter = null;
        }

        // Keep the overlay scrolled in lockstep with the textarea at all times
        this.textarea.addEventListener('scroll', () => {
            this.highlighter?.syncScroll();
        });
    }

    /**
     * Ease mouse-wheel scrolling on `element`
     * @param {HTMLElement} element - Scrollable panel to smooth (the
     *   editor textarea or the preview container)
     */
    setupSmoothWheelScroll(element) {
        if (!element) return;

        let targetScrollTop = element.scrollTop;
        let animating = false;
        let lastWrittenScrollTop = null;
        let stuckFrames = 0;

        const stopAnimating = () => {
            animating = false;
            lastWrittenScrollTop = null;
            stuckFrames = 0;
        };

        const step = () => {
            const current = element.scrollTop;

            if (lastWrittenScrollTop !== null && Math.abs(current - lastWrittenScrollTop) > 1) {
                stopAnimating();
                return;
            }

            const diff = targetScrollTop - current;

            if (Math.abs(diff) < 0.5) {
                element.scrollTop = targetScrollTop;
                stopAnimating();
                return;
            }

            element.scrollTop = current + diff * 0.2;

            if (element.scrollTop === current) {
                stuckFrames++;
                if (stuckFrames >= 2) {
                    stopAnimating();
                    return;
                }
                requestAnimationFrame(step);
                return;
            }

            stuckFrames = 0;
            lastWrittenScrollTop = element.scrollTop;
            requestAnimationFrame(step);
        };

        element.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

            e.preventDefault();

            // Re-sync to the element's actual position
            if (!animating) {
                targetScrollTop = element.scrollTop;
            }

            const maxScrollTop = element.scrollHeight - element.clientHeight;
            targetScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop + e.deltaY));

            if (!animating) {
                animating = true;
                lastWrittenScrollTop = element.scrollTop;
                stuckFrames = 0;
                requestAnimationFrame(step);
            }
        }, { passive: false });
    }

    /**
     * Load preview mode from localStorage
     */
    loadPreviewMode() {
        const savedMode = Storage.getItem('previewMode');
        if (savedMode === 'document' || savedMode === 'simple') {
            this.previewMode = savedMode;
        }
        
        // Set data attribute on preview container
        this.previewContainer.setAttribute('data-preview-mode', this.previewMode);
    }

    /**
     * Get current preview mode
     * @returns {string} Current preview mode
     */
    getPreviewMode() {
        return this.previewMode;
    }

    /**
     * Set preview mode
     * @param {string} mode - 'simple' or 'document'
     */
    setPreviewMode(mode) {
        if (mode === 'simple' || mode === 'document') {
            this.previewMode = mode;
            Storage.setItem('previewMode', mode);
            this.previewContainer.setAttribute('data-preview-mode', mode);
            this.updatePreview();
        }
    }

    /**
     * Set up event listeners for the editor
     */
    setupEventListeners() {
        // Input event with debouncing
        this.textarea.addEventListener('input', () => {
            this.handleInput();
            this.handleAutoSave();
        });

        // Handle tab key for indentation
        this.textarea.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        // Load saved preferences
        this.lineNumbers.loadPreference();
    }

    /**
     * Intercept clicks on in-document anchor links (`[text](#some-heading)`.
     */
    setupAnchorLinkHandling() {
        this.previewContainer.addEventListener('click', (event) => {
            const link = event.target.closest('a[href^="#"]');
            if (!link || !this.previewContainer.contains(link)) return;

            const id = decodeURIComponent(link.getAttribute('href').slice(1));
            if (!id) return;

            const target = this.previewContainer.querySelector(`#${CSS.escape(id)}`);
            if (!target) return;

            event.preventDefault();
            this.scrollPreviewToElementId(id);

            const line = parseInt(target.dataset.lineStart, 10);
            if (!Number.isNaN(line)) {
                this.scrollToLineCentered(line);
            }
        });
    }

    /**
     * Scroll the preview to the heading with the given anchor id, in
     * whichever preview mode is currently active. Used by both in-preview
     * anchor-link clicks and the TOC side panel.
     * @param {string} id - Heading anchor id (no leading '#')
     */
    scrollPreviewToHeading(id) {
        if (!id) return;

        if (this.previewMode === 'document') {
            window.markdownPDFApp?.pagedPreviewRenderer?.scrollToAnchor(id);
        } else {
            this.scrollPreviewToElementId(id);
        }
    }

    /**
     * Smoothly scroll the simple-mode preview so the element with `id` is
     * at the top.
     * @param {string} id - Element id (no leading '#')
     */
    scrollPreviewToElementId(id) {
        const target = this.previewContainer.querySelector(`#${CSS.escape(id)}`);
        if (!target) return;

        const offset = target.getBoundingClientRect().top
            - this.previewContainer.getBoundingClientRect().top
            + this.previewContainer.scrollTop;
        this.previewContainer.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    }

    /**
     * Handle input with debouncing
     */
    handleInput() {
        this.highlighter?.update();

        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new timer
        this.debounceTimer = setTimeout(() => {
            this.updatePreview();
        }, this.debounceDelay);
        
        // Update line numbers if enabled
        if (this.lineNumbers.enabled) {
            this.lineNumbers.update();
        }
    }
    
    /**
     * Handle auto-save with debouncing
     */
    handleAutoSave() {
        // Clear existing timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Set new timer
        this.autoSaveTimer = setTimeout(() => {
            this.autoSave();
        }, this.autoSaveDelay);
    }
    
    /**
     * Auto-save content to localStorage
     */
    autoSave() {
        const content = this.textarea.value;
        Storage.setItem('editor_autosave', content);
        Storage.setItem('editor_autosave_timestamp', Date.now());
    }

    /**
     * Restore auto-saved content if available
     * @returns {boolean} True if content was restored
     */
    restoreAutoSave() {
        const content = Storage.getItem('editor_autosave');
        const timestamp = Storage.getItem('editor_autosave_timestamp');

        if (!content || !timestamp) return false;

        // Only restore if less than 24 hours old
        const age = Date.now() - timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (age > maxAge) {
            Storage.removeItem('editor_autosave');
            Storage.removeItem('editor_autosave_timestamp');
            return false;
        }
        
        this.setContent(content);
        return true;
    }

    /**
     * Handle special keyboard shortcuts
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {

        if (e.key === 'Tab' && !this.findReplace.visible) {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
        }

        // Ctrl/Cmd + S - Save (prevent browser save dialog)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.manualSave();
        }

        // Ctrl/Cmd + B - Bold
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            this.wrapSelection('**', '**');
        }

        // Ctrl/Cmd + I - Italic
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            this.wrapSelection('*', '*');
        }

        // Ctrl/Cmd + K - Code
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.wrapSelection('`', '`');
        }
        
        // Ctrl/Cmd + F - Find
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.toggleFindReplace();
        }
        
        // Ctrl/Cmd + H - Replace
        if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
            e.preventDefault();
            this.toggleFindReplace(true);
        }
        
        // Escape - Close find/replace
        if (e.key === 'Escape' && this.findReplace.visible) {
            this.findReplace.close();
        }
    }
    
    /**
     * Manual save triggered by Ctrl+S
     */
    manualSave() {
        // Trigger FileManager save if available
        const fileManager = window.markdownPDFApp?.fileManager;
        if (fileManager && typeof fileManager.saveProject === 'function') {
            fileManager.saveProject();
        } else {
            // Fallback: just auto-save
            this.autoSave();
            this.showNotification('Content saved to browser storage', 'success');
        }
    }

    /**
     * Wrap selected text with prefix and suffix
     * @param {string} prefix - Text to add before selection
     * @param {string} suffix - Text to add after selection
     */
    wrapSelection(prefix, suffix) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;
        const selectedText = value.substring(start, end);

        // If nothing selected, just insert the markers
        const newText = selectedText || 'text';
        const replacement = prefix + newText + suffix;

        document.execCommand('insertText', false, replacement);

        // Select the wrapped text (excluding markers if text was selected)
        if (selectedText) {
            this.textarea.selectionStart = start + prefix.length;
            this.textarea.selectionEnd = end + prefix.length;
        } else {
            this.textarea.selectionStart = start + prefix.length;
            this.textarea.selectionEnd = start + prefix.length + newText.length;
        }

        this.textarea.focus();
    }

    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();

            this.textarea.focus();
            const inserted = document.execCommand('insertText', false, text);
            if (!inserted) {
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                const value = this.textarea.value;
                this.textarea.value = value.substring(0, start) + text + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
                this.handleInput();
            }
        } catch (error) {
            console.error('Paste failed:', error);
            this.showNotification('Paste failed - clipboard access was denied or unavailable', 'error');
        }
    }

    /**
     * Update the preview with rendered content
     */
    async updatePreview() {
        const markdown = this.textarea.value;

        // Update word count
        this.updateWordCount(markdown);

        // Document mode - use the paginated (Paged.js) preview with real page breaks
        if (this.previewMode === 'document' && this.settingsManager) {
            await this.updateDocumentPreview(markdown);
        } else {
            // Simple mode - just render markdown
            await this.updateSimplePreview(markdown);
        }

        this.rebuildContentMap();
    }

    /**
     * Update preview in simple mode
     * @param {string} markdown - Markdown content
     */
    async updateSimplePreview(markdown) {
        // Match the page margins configured in Settings, same as the PDF/document preview
        this.applyPreviewMargins();

        // Render markdown to HTML (async due to image resolution)
        let html = await this.renderer.render(markdown);

        if (this.documentStructure && this.settingsManager) {
            const settings = this.settingsManager.getSettings();
            if (settings.toc.enabled) {
                let tocStyleEl = document.getElementById('toc-preview-styles');
                if (!tocStyleEl) {
                    tocStyleEl = document.createElement('style');
                    tocStyleEl.id = 'toc-preview-styles';
                    document.head.appendChild(tocStyleEl);
                }
                tocStyleEl.textContent = this.documentStructure.getTOCStyles();

                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = html;
                const tocHTML = this.documentStructure.generateTOC(contentDiv, settings);
                html = tocHTML + contentDiv.innerHTML;
            }
        }

        // Update preview
        this.previewContainer.innerHTML =
            `<div class="simple-preview-scale-wrapper"><div class="simple-preview-page">${html}</div></div>`;

        // Render mermaid diagrams.
        await this.mermaidRenderer.renderDiagrams(this.previewContainer);

        // Render LaTeX/KaTeX
        this.mathRenderer?.renderMath(this.previewContainer);

        // Attach drag-to-resize.
        this.imageResizer.attach(this.previewContainer);

        this.applySimplePreviewScale();

        const blockList = extractBlockSizes(markdown);
        this.blockResizer.attach(this.previewContainer, blockList);

        this.applySimplePreviewScale();

        this.updatePageCountBadge(null);
    }

    /**
     * The physical page width (px) the simple preview should render at
     * before being shrunk to fit the panel - same page-size source PDF
     * Preview uses, so both scale from the same natural size.
     * @returns {number|null}
     */
    getSimplePreviewPageWidthPx() {
        if (!this.documentStructure || !this.settingsManager) return null;
        const settings = this.settingsManager.getSettings();
        return this.documentStructure.getPageDimensionsMM(settings.pageSize).width * PX_PER_MM;
    }

    applySimplePreviewScale() {
        const page = this.previewContainer.querySelector('.simple-preview-page');
        const pageWidthPx = this.getSimplePreviewPageWidthPx();
        if (!page || !pageWidthPx) return;

        page.style.width = `${pageWidthPx}px`;

        if (!this.simplePreviewResizeObserver) {
            this.simplePreviewResizeObserver = new ResizeObserver(() => this.scaleSimplePreview());
            this.simplePreviewResizeObserver.observe(this.previewContainer);
        }
        this.scaleSimplePreview();
    }

    scaleSimplePreview() {
        const page = this.previewContainer.querySelector('.simple-preview-page');
        const wrapper = this.previewContainer.querySelector('.simple-preview-scale-wrapper');
        const pageWidthPx = this.getSimplePreviewPageWidthPx();
        if (!page || !wrapper || !pageWidthPx) return;

        const naturalHeight = page.scrollHeight;
        const style = getComputedStyle(this.previewContainer);
        const availableWidth = this.previewContainer.clientWidth
            - parseFloat(style.paddingLeft)
            - parseFloat(style.paddingRight)
            - 1;
        const scale = availableWidth > 0 ? Math.min(1, availableWidth / pageWidthPx) : 1;

        page.style.transform = `scale(${scale})`;
        wrapper.style.width = `${Math.floor(pageWidthPx * scale)}px`;
        wrapper.style.height = `${Math.floor(naturalHeight * scale)}px`;

        this.simplePreviewScale = scale;
    }

    /**
     * Current shrink-to-fit scale of the simple preview (1 when not
     * scaled down). ImageResizer reads this to convert screen-space drag
     * deltas into the page's own (unscaled) coordinate space.
     * @returns {number}
     */
    getSimplePreviewScale() {
        return this.simplePreviewScale || 1;
    }

    applyPreviewMargins() {
        if (!this.settingsManager) return;

        const { top, right, bottom, left } = this.settingsManager.getSettings().margins;
        this.previewContainer.style.setProperty('--preview-margin-top', `${top}mm`);
        this.previewContainer.style.setProperty('--preview-margin-right', `${right}mm`);
        this.previewContainer.style.setProperty('--preview-margin-bottom', `${bottom}mm`);
        this.previewContainer.style.setProperty('--preview-margin-left', `${left}mm`);
    }

    /**
     * Update preview in document mode with a live, in-browser paginated
     * preview (Paged.js) — shows real page breaks without a backend round-trip.
     * @param {string} markdown - Markdown content
     */
    async updateDocumentPreview(markdown) {
        const pagedPreviewRenderer = window.markdownPDFApp?.pagedPreviewRenderer;

        if (!pagedPreviewRenderer) {
            console.warn('PagedPreviewRenderer not available, falling back to simple preview');
            await this.updateSimplePreview(markdown);
            return;
        }

        try {
            const themeSelector = document.getElementById('theme-selector');
            const theme = themeSelector ? themeSelector.value : 'modern';
            const codeThemeSelector = document.getElementById('code-theme-selector');
            const codeTheme = codeThemeSelector ? codeThemeSelector.value : 'default';
            const settings = this.settingsManager.getSettings();

            const totalPages = await pagedPreviewRenderer.render(markdown, this.renderer, theme, settings, this.previewContainer, codeTheme);
            this.updatePageCountBadge(totalPages);

        } catch (error) {
            console.error('Document preview failed:', error);

            // Fall back to simple preview
            await this.updateSimplePreview(markdown);

            // Show error notification
            this.showPreviewError('Document preview unavailable. Using simple preview.');
        }
    }

    /**
     * Update the page-count badge next to the preview mode toggle.
     * @param {number|null} total - Total page count from the paginated
     *   preview, or null to hide the badge (simple mode / no result yet)
     */
    updatePageCountBadge(total) {
        const badge = document.getElementById('preview-page-count');
        if (!badge) return;

        if (!total) {
            badge.hidden = true;
            badge.textContent = '';
            return;
        }

        badge.hidden = false;
        badge.textContent = total === 1 ? '1 page' : `${total} pages`;
    }

    /**
     * Show preview error notification
     * @param {string} message - Error message
     */
    showPreviewError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 5rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            background: #fee;
            border: 1px solid #fcc;
            border-left: 4px solid #ef4444;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
            z-index: 1000;
            max-width: 350px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    /**
     * Add header and footer placeholders to preview
     * @param {HTMLElement} content - Content element
     * @param {Object} settings - Current settings
     * @returns {HTMLElement} Content with placeholders
     */
    addHeaderFooterPlaceholders(content, settings) {
        const wrapper = document.createElement('div');
        wrapper.className = 'document-content-wrapper';

        // Add header placeholder if enabled
        if (settings.headers?.enabled) {
            const headerPlaceholder = document.createElement('div');
            headerPlaceholder.className = 'header-placeholder';
            const headerText = settings.headers.template || '{title}';
            headerPlaceholder.textContent = this.replacePlaceholders(headerText, settings);
            wrapper.appendChild(headerPlaceholder);
        }

        // Add main content
        wrapper.appendChild(content);

        // Add footer placeholder if enabled
        if (settings.footers?.enabled) {
            const footerPlaceholder = document.createElement('div');
            footerPlaceholder.className = 'footer-placeholder';
            let footerText = '';
            
            if (settings.footers.pageNumbers && settings.footers.template) {
                footerText = settings.footers.template;
            } else if (settings.footers.pageNumbers) {
                footerText = 'Page {page} of {total}';
            } else if (settings.footers.template) {
                footerText = settings.footers.template;
            }
            
            footerPlaceholder.textContent = this.replacePlaceholders(footerText, settings);
            wrapper.appendChild(footerPlaceholder);
        }

        return wrapper;
    }

    /**
     * Replace placeholders in template text
     * @param {string} text - Template text
     * @param {Object} settings - Settings object
     * @returns {string} Text with placeholders replaced
     */
    replacePlaceholders(text, settings) {
        if (!text) return '';
        
        return text
            .replace(/{title}/g, settings.metadata?.title || 'Document Title')
            .replace(/{author}/g, settings.metadata?.author || 'Author')
            .replace(/{date}/g, new Date().toLocaleDateString())
            .replace(/{page}/g, '1')
            .replace(/{total}/g, '?');
    }

    /**
     * Update word count display
     * @param {string} text - Text to count
     */
    updateWordCount(text) {
        if (!this.wordCountElement) return;

        const wordCount = this.renderer.countWords(text);
        const charCount = text.length;
        const charCountNoSpaces = text.replace(/\s/g, '').length;
        
        this.wordCountElement.textContent = `${wordCount} words | ${charCount} characters`;
        
        // Update character count element if it exists
        if (this.charCountElement) {
            this.charCountElement.textContent = `${charCount} chars (${charCountNoSpaces} without spaces)`;
        }
    }
    
    /**
     * Toggle line numbers
     */
    toggleLineNumbers() {
        return this.lineNumbers.toggle();
    }

    /**
     * Toggle find/replace panel
     * @param {boolean} showReplace - Whether to show replace field
     */
    toggleFindReplace(showReplace = false) {
        return this.findReplace.toggle(showReplace);
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     */
    showNotification(message, type = 'info') {
        if (type !== 'error') return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        notification.style.cssText = `
            position: fixed;
            top: 5rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            background: #fef2f2;
            border: 1px solid #ef4444;
            border-left: 4px solid #ef4444;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
            z-index: 1000;
            max-width: 350px;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Get current markdown content
     * @returns {string} Current markdown
     */
    getContent() {
        return this.textarea.value;
    }

    /**
     * Set markdown content
     * @param {string} markdown - Markdown to set
     */
    setContent(markdown) {
        this.textarea.value = markdown;
        this.highlighter?.update();
        this.updatePreview();
    }

    /**
     * Clear editor content
     */
    clear() {
        this.textarea.value = '';
        this.highlighter?.update();
        this.updatePreview();
    }
    
    
    /**
     * Initialize scroll synchronization system
     */
    initScrollSync() {
        return this.scrollSync.initScrollSync();
    }

    /**
     * Toggle scroll synchronization
     */
    toggleScrollSync() {
        return this.scrollSync.toggleScrollSync();
    }

    /**
     * Rebuild content map after preview updates
     */
    rebuildContentMap() {
        return this.scrollSync.rebuildContentMap();
    }

    /**
     * Scroll editor to center line in viewport, and move the actual text
     * cursor there too - otherwise the caret silently stays wherever it
     * was before the jump (often scrolled off-screen), so anything typed
     * afterwards lands at that stale position instead of the line the
     * view just scrolled to.
     * @param {number} lineNumber - Line number to scroll to (1-based)
     * @param {number} [selectionStart] - Exact selection start char offset
     * @param {number} [selectionEnd] - Exact selection end char offset
     */
    scrollToLineCentered(lineNumber, selectionStart, selectionEnd) {
        return this.scrollSync.scrollToLineCentered(lineNumber, selectionStart, selectionEnd);
    }
}
