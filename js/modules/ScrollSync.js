/**
 * ScrollSync Module
 * Manages editor↔preview scroll synchronization
 */

import { ScrollSyncMapper } from './ScrollSyncMapper.js';
import * as Storage from './Storage.js';

export class ScrollSync {
    constructor(editor) {
        this.editor = editor;
        this.enabled = false;
        this.mapper = null;
        this.activePanel = null;
        this.scrollDebounceTimer = null;
        this.cursorScrollTimer = null;
        this.mapRebuildTimer = null;
        this.isProgrammaticScroll = false;
    }

    /**
     * Initialize scroll synchronization system
     */
    initScrollSync() {
        if (!this.editor.textarea || !this.editor.previewContainer) {
            console.warn('[SCROLL SYNC] Cannot init scroll sync: elements not available', {
                textarea: !!this.editor.textarea,
                previewContainer: !!this.editor.previewContainer
            });
            return;
        }

        // Create content mapper
        this.mapper = new ScrollSyncMapper(this.editor.textarea, this.editor.previewContainer);

        // Load saved preference - default to enabled
        const saved = Storage.getItem('scroll_sync_enabled');

        if (saved === false) {
            this.disableScrollSync(true);
        } else {
            // Enable by default
            this.enableScrollSync(true);
        }
    }

    /**
     * Enable scroll synchronization
     * @param {boolean} silent - Skip the confirmation notification; used
     *   when applying the saved/default preference on startup, where
     *   there's no user action to confirm and the notification would just
     *   pop up unprompted during page load.
     */
    enableScrollSync(silent = false) {
        if (this.enabled) {
            return;
        }

        this.enabled = true;
        Storage.setItem('scroll_sync_enabled', true);

        // Build initial content map
        this.rebuildContentMap();

        // Add mouse tracking to know which panel user is actively using
        this.editor.textarea.addEventListener('mouseenter', () => {
            this.activePanel = 'editor';
        });
        this.editor.previewContainer.addEventListener('mouseenter', () => {
            this.activePanel = 'preview';
        });

        // Add scroll listeners
        this.editor.textarea.addEventListener('scroll', this.handleEditorScroll.bind(this));
        this.editor.previewContainer.addEventListener('scroll', this.handlePreviewScroll.bind(this));

        // Update button state
        this.updateScrollSyncButton(true);

        if (!silent) {
            this.editor.showNotification('Scroll synchronization enabled', 'success');
        }
    }

    /**
     * Disable scroll synchronization
     * @param {boolean} silent - Skip the confirmation notification; see
     *   enableScrollSync's silent param.
     */
    disableScrollSync(silent = false) {
        if (!this.enabled) {
            return;
        }

        this.enabled = false;
        Storage.setItem('scroll_sync_enabled', false);

        // Update button state
        this.updateScrollSyncButton(false);

        if (!silent) {
            this.editor.showNotification('Scroll synchronization disabled', 'info');
        }
    }

    /**
     * Toggle scroll synchronization
     */
    toggleScrollSync() {
        if (this.enabled) {
            this.disableScrollSync();
        } else {
            this.enableScrollSync();
        }
        return this.enabled;
    }

    /**
     * Update scroll sync button state
     * @param {boolean} active - Whether sync is active
     */
    updateScrollSyncButton(active) {
        const button = document.getElementById('editor-scroll-sync-toggle');
        if (button) {
            if (active) {
                button.classList.add('active');
                button.setAttribute('aria-pressed', 'true');
                button.title = 'Scroll sync enabled (Alt+S to disable)';
            } else {
                button.classList.remove('active');
                button.setAttribute('aria-pressed', 'false');
                button.title = 'Scroll sync disabled (Alt+S to enable)';
            }
        }
    }

    /**
     * Rebuild content map after preview updates
     */
    rebuildContentMap() {
        if (!this.enabled || !this.mapper) {
            return;
        }

        // Debounce map rebuilding to avoid too frequent updates
        clearTimeout(this.mapRebuildTimer);
        this.mapRebuildTimer = setTimeout(() => {
            // Wait for preview to finish rendering
            requestAnimationFrame(() => {
                this.mapper.buildMap();
            });
        }, 200);
    }

    /**
     * Handle editor scroll event
     * @param {Event} event - Scroll event
     */
    handleEditorScroll(event) {
        // Ignore if this is a programmatic scroll
        if (this.isProgrammaticScroll) {
            return;
        }

        // Only sync if scroll sync is enabled and user is actively on editor
        if (!this.enabled) {
            return;
        }
        if (this.activePanel !== 'editor') {
            return;
        }

        // Clear any pending sync and debounce
        clearTimeout(this.scrollDebounceTimer);
        this.scrollDebounceTimer = setTimeout(() => {
            this.syncPreviewToEditor();
        }, 0.1);
    }

    /**
     * Handle preview scroll event
     * @param {Event} event - Scroll event
     */
    handlePreviewScroll(event) {
        // Ignore if this is a programmatic scroll
        if (this.isProgrammaticScroll) {
            return;
        }

        // Only sync if scroll sync is enabled and user is actively on preview
        if (!this.enabled) {
            return;
        }
        if (this.activePanel !== 'preview') {
            return;
        }

        // Clear any pending sync and debounce
        clearTimeout(this.scrollDebounceTimer);
        this.scrollDebounceTimer = setTimeout(() => {
            this.syncEditorToPreview();
        }, 0.1);
    }

    /**
     * Sync preview scroll to editor position.
     */
    syncPreviewToEditor() {
        if (!this.mapper || !this.mapper.map) return;

        const editorScrollTop = this.editor.textarea.scrollTop;
        const editorMaxScroll = this.editor.textarea.scrollHeight - this.editor.textarea.clientHeight;

        if (editorScrollTop < 50) {
            this.setPreviewScroll(0);
            return;
        }

        if (editorMaxScroll <= 0 || editorScrollTop > editorMaxScroll - 50) {
            const previewMaxScroll = this.editor.previewContainer.scrollHeight - this.editor.previewContainer.clientHeight;
            this.setPreviewScroll(previewMaxScroll);
            return;
        }

        const target = this.mapper.mapEditorToPreview(editorScrollTop);
        if (target === null) return;

        this.setPreviewScroll(Math.max(0, target));
    }

    /**
     * Inverse of syncPreviewToEditor.
     */
    syncEditorToPreview() {
        if (!this.mapper || !this.mapper.map) return;

        const previewScrollTop = this.editor.previewContainer.scrollTop;
        const previewMaxScroll = this.editor.previewContainer.scrollHeight - this.editor.previewContainer.clientHeight;

        if (previewScrollTop < 50) {
            this.setEditorScroll(0);
            return;
        }

        if (previewMaxScroll <= 0 || previewScrollTop > previewMaxScroll - 50) {
            const editorMaxScroll = this.editor.textarea.scrollHeight - this.editor.textarea.clientHeight;
            this.setEditorScroll(editorMaxScroll);
            return;
        }

        const target = this.mapper.mapPreviewToEditor(previewScrollTop);
        if (target === null) return;

        this.setEditorScroll(Math.max(0, target));
    }

    /**
     * Set the preview's scroll position programmatically, guarding
     * isProgrammaticScroll so the resulting native 'scroll' event doesn't
     * bounce back into syncEditorToPreview().
     * @param {number} value
     */
    setPreviewScroll(value) {
        this.isProgrammaticScroll = true;
        requestAnimationFrame(() => {
            this.editor.previewContainer.scrollTop = value;
            setTimeout(() => { this.isProgrammaticScroll = false; }, 100);
        });
    }

    /**
     * Editor counterpart of setPreviewScroll.
     * @param {number} value
     */
    setEditorScroll(value) {
        this.isProgrammaticScroll = true;
        requestAnimationFrame(() => {
            this.editor.textarea.scrollTop = value;
            setTimeout(() => { this.isProgrammaticScroll = false; }, 100);
        });
    }

    /**
     * Handle cursor movement for auto-scroll to cursor
     * @param {Event} event - Event that triggered cursor move
     */
    handleCursorMove(event) {
        if (!this.enabled) return;

        // Debounce auto-scroll
        clearTimeout(this.cursorScrollTimer);
        this.cursorScrollTimer = setTimeout(() => {
            this.autoScrollToCursor();
        }, 300);
    }

    /**
     * Auto-scroll preview to cursor position
     */
    autoScrollToCursor() {
        if (!this.mapper || !this.mapper.map) return;

        const cursorLine = this.getCursorLine();
        const elementInfo = this.mapper.findElementForLine(cursorLine);

        if (elementInfo) {
            this.scrollToElementCentered(elementInfo.element, true);
        }
    }

    /**
     * Get current cursor line number in editor
     * @returns {number} Current line number (1-based)
     */
    getCursorLine() {
        const cursorPos = this.editor.textarea.selectionStart;
        const textBeforeCursor = this.editor.textarea.value.substring(0, cursorPos);
        return textBeforeCursor.split('\n').length;
    }

    /**
     * Scroll element to center of viewport with smooth animation
     * @param {HTMLElement} element - Element to scroll to
     * @param {boolean} smooth - Whether to use smooth scrolling
     */
    scrollToElementCentered(element, smooth = true) {
        if (!element || !this.editor.previewContainer) return;

        const elementTop = element.offsetTop;
        const elementHeight = element.offsetHeight;
        const containerHeight = this.editor.previewContainer.clientHeight;

        // Calculate position to center element in viewport
        const scrollTo = elementTop - (containerHeight / 2) + (elementHeight / 2);

        if (smooth) {
            this.editor.previewContainer.scrollTo({
                top: Math.max(0, scrollTo),
                behavior: 'smooth'
            });
        } else {
            this.editor.previewContainer.scrollTop = Math.max(0, scrollTo);
        }
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
        if (!this.editor.textarea) return;

        // Character offset of the start of lineNumber
        const lines = this.editor.textarea.value.split('\n');
        const targetIndex = Math.min(Math.max(lineNumber, 1), lines.length) - 1;
        let charOffset = 0;
        for (let i = 0; i < targetIndex; i++) {
            charOffset += lines[i].length + 1;
        }

        const start = selectionStart ?? charOffset;
        const end = selectionEnd ?? start;

        this.editor.textarea.focus();
        this.editor.textarea.setSelectionRange(start, end);

        // Calculate approximate line height
        const computedStyle = getComputedStyle(this.editor.textarea);
        const lineHeight = parseInt(computedStyle.lineHeight) || 20;
        const lineTop = (lineNumber - 1) * lineHeight;
        const containerHeight = this.editor.textarea.clientHeight;

        // Calculate position to center line in viewport
        const scrollTo = lineTop - (containerHeight / 2) + (lineHeight / 2);

        this.isProgrammaticScroll = true;
        clearTimeout(this._scrollToLineFallbackTimer);

        const clearGuard = () => {
            this.isProgrammaticScroll = false;
            this.editor.textarea.removeEventListener('scrollend', clearGuard);
            clearTimeout(this._scrollToLineFallbackTimer);
        };

        if ('onscrollend' in window) {
            this.editor.textarea.addEventListener('scrollend', clearGuard, { once: true });
        }

        this._scrollToLineFallbackTimer = setTimeout(clearGuard, 1000);

        this.editor.textarea.scrollTo({
            top: Math.max(0, scrollTo),
            behavior: 'smooth'
        });
    }
}
