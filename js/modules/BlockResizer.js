/**
 * BlockResizer Module
 * Makes fenced code blocks, Mermaid diagrams, and display math ($$...$$)
 * visually resizable in the preview.
 */

import { MIN_SCALE, MAX_SCALE } from './BlockSizeParser.js';

/**
 * Apply every stored `<!-- size: N% -->` scale onto the matching rendered element in
 * `container`, wrapping each in a `.block-resize-wrapper` sized to its
 * scaled visual footprint
 * @param {HTMLElement} container - Root to search within
 * @param {Array} blockList - Ordered descriptors from extractBlockSizes()
 * @param {{wrapAll?: boolean}} [options] - wrapAll: also wrap blocks with
 * @returns {Array<{wrapper: HTMLElement, target: HTMLElement, descriptor: Object}>}
 */
function applyStoredScales(container, blockList, options) {
    options = options || {};
    const wrapAll = !!options.wrapAll;
    const results = [];

    const elements = container.querySelectorAll('pre > code.hljs, .mermaid[data-line-start], .katex-display, table[data-line-start]');

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const descriptor = blockList[i];
        if (!descriptor) continue;

        const scale = descriptor.scale;
        if (scale == null && !wrapAll) continue;

        const type = descriptor.type;
        // Code blocks resize as a whole <pre>, not just the inner <code>.
        const target = type === 'code' ? el.parentElement : el;
        if (!target || !target.parentNode) continue;

        if (target.parentElement && target.parentElement.classList && target.parentElement.classList.contains('block-resize-wrapper')) {
            continue;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'block-resize-wrapper' + (type === 'math' ? ' block-resize-wrapper--math' : '');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'block';
        target.parentNode.insertBefore(wrapper, target);
        wrapper.appendChild(target);

        if (type === 'math') {
            wrapper.style.width = 'fit-content';
            wrapper.style.margin = '1em auto';
            target.style.display = 'inline-block';
            target.style.width = 'auto';
            target.style.margin = '0';
        }

        const effectiveScale = scale == null ? 1 : scale;
        const naturalWidth = target.offsetWidth;
        const naturalHeight = target.offsetHeight;

        target.style.width = naturalWidth + 'px';

        if (effectiveScale !== 1) {
            target.style.transform = 'scale(' + effectiveScale + ')';
            target.style.transformOrigin = 'top left';
            wrapper.style.width = Math.round(naturalWidth * effectiveScale) + 'px';
            wrapper.style.height = Math.round(naturalHeight * effectiveScale) + 'px';
        }
        wrapper.dataset.scale = String(effectiveScale);

        results.push({ wrapper, target, descriptor });
    }

    return results;
}

export { applyStoredScales };

export class BlockResizer {
    constructor(editor) {
        this.editor = editor;
        this.activeWrapper = null;
        this.activeTarget = null;
        this.activeDescriptor = null;
        this.startX = 0;
        this.startScale = 1;
        this.naturalWidth = 0;
        this.naturalHeight = 0;

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    /**
     * Apply stored scales and wire up dragging.
     * @param {HTMLElement} previewContainer
     * @param {Array} blockList - From BlockSizeParser.extractBlockSizes()
     */
    attach(previewContainer, blockList) {
        const wrapped = applyStoredScales(previewContainer, blockList, { wrapAll: true });
        wrapped.forEach(({ wrapper, target, descriptor }) => {
            this.addHandle(wrapper, target, descriptor);
        });
    }

    /**
     * Add a corner drag handle to one already-wrapped block.
     * @param {HTMLElement} wrapper
     * @param {HTMLElement} target
     * @param {Object} descriptor
     */
    addHandle(wrapper, target, descriptor) {
        const handle = document.createElement('div');
        handle.className = 'block-resize-handle';
        handle.title = 'Drag to resize';
        wrapper.appendChild(handle);

        handle.addEventListener('mousedown', (e) => this.startDrag(e, wrapper, target, descriptor));
    }

    /**
     * Begin a drag-resize.
     * @param {MouseEvent} e
     * @param {HTMLElement} wrapper
     * @param {HTMLElement} target
     * @param {Object} descriptor
     */
    startDrag(e, wrapper, target, descriptor) {
        e.preventDefault();
        this.activeWrapper = wrapper;
        this.activeTarget = target;
        this.activeDescriptor = descriptor;
        this.startX = e.clientX;
        this.naturalWidth = target.offsetWidth;
        this.naturalHeight = target.offsetHeight;
        this.startScale = parseFloat(wrapper.dataset.scale || '1');

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    /**
     * Live-resize as the mouse moves, uniformly scaling the whole block.
     * @param {MouseEvent} e
     */
    handleMouseMove(e) {
        if (!this.activeTarget || !this.naturalWidth) return;

        const previewScale = this.editor.getSimplePreviewScale?.() ?? 1;
        const delta = (e.clientX - this.startX) / previewScale;
        const scaleDelta = delta / this.naturalWidth;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.startScale + scaleDelta));

        this.activeTarget.style.transform = `scale(${newScale})`;
        this.activeTarget.style.transformOrigin = 'top left';
        this.activeWrapper.style.width = `${Math.round(this.naturalWidth * newScale)}px`;
        this.activeWrapper.style.height = `${Math.round(this.naturalHeight * newScale)}px`;
        this.activeWrapper.dataset.scale = String(newScale);
    }

    /**
     * Finish the drag and write the final scale back into the markdown.
     */
    handleMouseUp() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        if (!this.activeWrapper) return;

        const finalScale = parseFloat(this.activeWrapper.dataset.scale || '1');
        const descriptor = this.activeDescriptor;
        this.activeWrapper = null;
        this.activeTarget = null;
        this.activeDescriptor = null;

        if (descriptor) {
            this.writeScaleToMarkdown(descriptor, finalScale);
        }
    }

    /**
     * Rewrite (or insert) the block's trailing `<!-- size: N% -->` comment
     * to carry the new scale, then trigger a preview update. 
     * @param {Object} descriptor
     * @param {number} scale
     */
    writeScaleToMarkdown(descriptor, scale) {
        const textarea = this.editor.textarea;
        const content = textarea.value;
        const percent = Math.round(scale * 100);
        const commentText = `<!-- size: ${percent}% -->`;

        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;

        const newContent = descriptor.commentStart != null
            ? content.slice(0, descriptor.commentStart) + commentText + content.slice(descriptor.commentEnd)
            : content.slice(0, descriptor.blockEnd) + '\n' + commentText + content.slice(descriptor.blockEnd);

        textarea.value = newContent;
        textarea.selectionStart = selectionStart;
        textarea.selectionEnd = selectionEnd;

        this.editor.handleInput();
    }
}
