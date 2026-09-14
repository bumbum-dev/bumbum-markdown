/**
 * LineNumbers Module
 * Manages the editor's line-number gutter
 */

import * as Storage from './Storage.js';

export class LineNumbers {
    constructor(editor) {
        this.editor = editor;
        this.enabled = false;
        this._scrollListenerAttached = false;
    }

    /**
     * Toggle line numbers
     */
    toggle() {
        this.enabled = !this.enabled;

        // Save preference
        Storage.setItem('editor_line_numbers', this.enabled);

        // Update UI
        const editorPanel = this.editor.textarea.closest('.editor-panel');
        if (editorPanel) {
            if (this.enabled) {
                editorPanel.classList.add('line-numbers-enabled');
                this.create();
            } else {
                editorPanel.classList.remove('line-numbers-enabled');
                this.remove();
            }
        }

        return this.enabled;
    }

    /**
     * Create line numbers display
     */
    create() {
        let lineNumbersDiv = document.getElementById('line-numbers');

        if (!lineNumbersDiv) {
            lineNumbersDiv = document.createElement('div');
            lineNumbersDiv.id = 'line-numbers';
            lineNumbersDiv.className = 'line-numbers';

            const wrapper = this.editor.textarea.closest('.markdown-editor-wrapper');
            wrapper.insertBefore(lineNumbersDiv, this.editor.textarea);
        }

        if (!this._scrollListenerAttached) {
            this._scrollListenerAttached = true;
            this.editor.textarea.addEventListener('scroll', () => {
                if (!this.enabled) return;
                const div = document.getElementById('line-numbers');
                if (div) div.scrollTop = this.editor.textarea.scrollTop;
            });
        }

        this.update();
    }

    /**
     * Remove line numbers display
     */
    remove() {
        const lineNumbersDiv = document.getElementById('line-numbers');
        if (lineNumbersDiv) {
            lineNumbersDiv.remove();
        }
    }

    /**
     * Update line numbers
     */
    update() {
        const lineNumbersDiv = document.getElementById('line-numbers');
        if (!lineNumbersDiv) return;

        const lines = this.editor.textarea.value.split('\n');
        const lineNumbers = lines.map((_, i) => i + 1).join('\n');
        lineNumbersDiv.textContent = lineNumbers;

        // Sync scroll position
        lineNumbersDiv.scrollTop = this.editor.textarea.scrollTop;
    }

    /**
     * Load editor preferences from localStorage
     */
    loadPreference() {
        // Load line numbers preference
        const lineNumbers = Storage.getItem('editor_line_numbers');
        if (lineNumbers === true) {
            this.enabled = true;
            this.toggle(); // This will create the line numbers
        }
    }
}
