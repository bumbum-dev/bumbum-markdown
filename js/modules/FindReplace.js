/**
 * FindReplace Module
 * Manages the editor's find/replace panel
 */

export class FindReplace {
    constructor(editor) {
        this.editor = editor;
        this.visible = false;
    }

    /**
     * Toggle find/replace panel
     * @param {boolean} showReplace - Whether to show replace field
     */
    toggle(showReplace = false) {
        if (this.visible) {
            this.close();
        } else {
            this.open(showReplace);
        }
    }

    /**
     * Open find/replace panel
     * @param {boolean} showReplace - Whether to show replace field
     */
    open(showReplace = false) {
        this.visible = true;

        // Create find/replace panel if it doesn't exist
        let findPanel = document.getElementById('find-replace-panel');

        if (!findPanel) {
            findPanel = document.createElement('div');
            findPanel.id = 'find-replace-panel';
            findPanel.className = 'find-replace-panel';
            findPanel.innerHTML = `
                <div class="find-replace-content">
                    <div class="find-group">
                        <input type="text" id="find-input" placeholder="Find" />
                        <button id="find-prev" title="Previous (Shift+Enter)">↑</button>
                        <button id="find-next" title="Next (Enter)">↓</button>
                        <span id="find-count" class="find-count"></span>
                    </div>
                    <div class="replace-group" style="display: ${showReplace ? 'flex' : 'none'};">
                        <input type="text" id="replace-input" placeholder="Replace" />
                        <button id="replace-one">Replace</button>
                        <button id="replace-all">Replace All</button>
                    </div>
                    <button id="find-close" class="find-close" title="Close (Esc)">×</button>
                </div>
            `;

            const editorPanel = this.editor.textarea.closest('.editor-panel');
            if (editorPanel) {
                editorPanel.appendChild(findPanel);
            }

            // Set up event listeners
            this.setupListeners();
        } else {
            findPanel.style.display = 'block';
            const replaceGroup = findPanel.querySelector('.replace-group');
            if (replaceGroup) {
                replaceGroup.style.display = showReplace ? 'flex' : 'none';
            }
        }

        // Focus find input
        setTimeout(() => {
            const findInput = document.getElementById('find-input');
            if (findInput) findInput.focus();
        }, 100);
    }

    /**
     * Close find/replace panel
     */
    close() {
        this.visible = false;
        const findPanel = document.getElementById('find-replace-panel');
        if (findPanel) {
            findPanel.style.display = 'none';
        }

        // Clear highlights
        this.clearHighlights();

        const { textarea, scrollSync } = this.editor;
        const scrollTop = textarea.scrollTop;
        scrollSync.isProgrammaticScroll = true;
        textarea.focus();
        textarea.scrollTop = scrollTop;
        setTimeout(() => { scrollSync.isProgrammaticScroll = false; }, 50);
    }

    /**
     * Setup find/replace event listeners
     */
    setupListeners() {
        const findInput = document.getElementById('find-input');
        const replaceInput = document.getElementById('replace-input');
        const findNext = document.getElementById('find-next');
        const findPrev = document.getElementById('find-prev');
        const replaceOne = document.getElementById('replace-one');
        const replaceAll = document.getElementById('replace-all');
        const findClose = document.getElementById('find-close');

        if (findInput) {
            findInput.addEventListener('input', () => this.performFind());
            findInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.findPrevious();
                    } else {
                        this.findNext();
                    }
                }
            });
        }

        if (findNext) {
            findNext.addEventListener('click', () => this.findNext());
        }

        if (findPrev) {
            findPrev.addEventListener('click', () => this.findPrevious());
        }

        if (replaceOne) {
            replaceOne.addEventListener('click', () => this.replaceOne());
        }

        if (replaceAll) {
            replaceAll.addEventListener('click', () => this.replaceAll());
        }

        if (findClose) {
            findClose.addEventListener('click', () => this.close());
        }
    }

    /**
     * Perform find operation
     */
    performFind() {
        const findInput = document.getElementById('find-input');
        const findCount = document.getElementById('find-count');

        if (!findInput || !findInput.value) {
            if (findCount) findCount.textContent = '';
            return;
        }

        const searchText = findInput.value;
        const content = this.editor.textarea.value;
        const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = content.match(regex);

        if (findCount) {
            findCount.textContent = matches ? `${matches.length} found` : 'Not found';
        }
    }

    /**
     * Find next occurrence
     */
    findNext() {
        const findInput = document.getElementById('find-input');
        if (!findInput || !findInput.value) return;

        const searchText = findInput.value;
        const content = this.editor.textarea.value;
        const currentPos = this.editor.textarea.selectionEnd;

        const index = content.toLowerCase().indexOf(searchText.toLowerCase(), currentPos);

        if (index !== -1) {
            const lineNumber = content.substring(0, index).split('\n').length;
            this.editor.scrollToLineCentered(lineNumber, index, index + searchText.length);
        } else {
            // Wrap to beginning
            const wrapIndex = content.toLowerCase().indexOf(searchText.toLowerCase(), 0);
            if (wrapIndex !== -1) {
                const lineNumber = content.substring(0, wrapIndex).split('\n').length;
                this.editor.scrollToLineCentered(lineNumber, wrapIndex, wrapIndex + searchText.length);
            }
        }
    }

    /**
     * Find previous occurrence
     */
    findPrevious() {
        const findInput = document.getElementById('find-input');
        if (!findInput || !findInput.value) return;

        const searchText = findInput.value;
        const content = this.editor.textarea.value;
        const currentPos = this.editor.textarea.selectionStart;

        const beforeCursor = content.substring(0, currentPos);
        const index = beforeCursor.toLowerCase().lastIndexOf(searchText.toLowerCase());

        if (index !== -1) {
            const lineNumber = content.substring(0, index).split('\n').length;
            this.editor.scrollToLineCentered(lineNumber, index, index + searchText.length);
        } else {
            // Wrap to end
            const wrapIndex = content.toLowerCase().lastIndexOf(searchText.toLowerCase());
            if (wrapIndex !== -1) {
                const lineNumber = content.substring(0, wrapIndex).split('\n').length;
                this.editor.scrollToLineCentered(lineNumber, wrapIndex, wrapIndex + searchText.length);
            }
        }
    }

    /**
     * Replace current selection
     */
    replaceOne() {
        const findInput = document.getElementById('find-input');
        const replaceInput = document.getElementById('replace-input');

        if (!findInput || !replaceInput || !findInput.value) return;

        const searchText = findInput.value;
        const replaceText = replaceInput.value;
        const start = this.editor.textarea.selectionStart;
        const end = this.editor.textarea.selectionEnd;
        const selectedText = this.editor.textarea.value.substring(start, end);

        // Only replace if the selected text matches the search text
        if (selectedText.toLowerCase() === searchText.toLowerCase()) {
            const content = this.editor.textarea.value;
            this.editor.textarea.value = content.substring(0, start) + replaceText + content.substring(end);
            this.editor.textarea.setSelectionRange(start, start + replaceText.length);

            // Trigger update
            this.editor.handleInput();
        }

        // Find next
        this.findNext();
    }

    /**
     * Replace all occurrences
     */
    replaceAll() {
        const findInput = document.getElementById('find-input');
        const replaceInput = document.getElementById('replace-input');

        if (!findInput || !replaceInput || !findInput.value) return;

        const searchText = findInput.value;
        const replaceText = replaceInput.value;
        const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

        const newContent = this.editor.textarea.value.replace(regex, replaceText);
        const count = (this.editor.textarea.value.match(regex) || []).length;

        this.editor.textarea.value = newContent;

        // Trigger update
        this.editor.handleInput();

        // Show notification
        this.editor.showNotification(`Replaced ${count} occurrence${count !== 1 ? 's' : ''}`, 'success');

        // Update find count
        this.performFind();
    }

    /**
     * Clear find highlights
     */
    clearHighlights() {
        // This would be used if we implement visual highlights in the future
    }
}
