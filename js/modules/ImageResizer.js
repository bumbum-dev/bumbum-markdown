/**
 * ImageResizer Module
 */

const MIN_WIDTH_PX = 20;

export class ImageResizer {
    constructor(editor) {
        this.editor = editor;
        this.activeImg = null;
        this.startX = 0;
        this.startWidth = 0;

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    /**
     * Attach a resize handle to every image[data-image-id] inside
     * previewContainer.
     * @param {HTMLElement} previewContainer
     */
    attach(previewContainer) {
        previewContainer.querySelectorAll('img[data-image-id]').forEach(img => {
            this.addHandle(img);
        });
    }

    /**
     * Wrap a single image in a positioned wrapper carrying its resize handle.
     * @param {HTMLImageElement} img
     */
    addHandle(img) {
        const wrapper = document.createElement('span');
        wrapper.className = 'image-resize-wrapper';
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);

        const handle = document.createElement('div');
        handle.className = 'image-resize-handle';
        handle.title = 'Drag to resize';
        wrapper.appendChild(handle);

        handle.addEventListener('mousedown', (e) => this.startDrag(e, img));
    }

    /**
     * Begin a drag-resize.
     * @param {MouseEvent} e
     * @param {HTMLImageElement} img
     */
    startDrag(e, img) {
        e.preventDefault();
        this.activeImg = img;
        this.startX = e.clientX;
        this.startWidth = img.offsetWidth;

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    /**
     * Live-resize the image as the mouse moves, preserving aspect ratio.
     * @param {MouseEvent} e
     */
    handleMouseMove(e) {
        if (!this.activeImg) return;

        const scale = this.editor.getSimplePreviewScale?.() ?? 1;
        const delta = (e.clientX - this.startX) / scale;
        const newWidth = Math.max(MIN_WIDTH_PX, Math.round(this.startWidth + delta));
        this.activeImg.style.width = `${newWidth}px`;
        this.activeImg.style.height = 'auto';
    }

    /**
     * Finish the drag and write the final width back into the markdown.
     */
    handleMouseUp() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        if (!this.activeImg) return;

        const finalWidth = Math.round(this.activeImg.offsetWidth);
        const imageId = this.activeImg.dataset.imageId;
        this.activeImg = null;

        if (imageId) {
            this.writeWidthToMarkdown(imageId, finalWidth);
        }
    }

    /**
     * Rewrite the `image:<id>` reference for imageId in the editor's
     * markdown to carry the new width, then trigger a preview update.
     * @param {string} imageId
     * @param {number} width
     */
    writeWidthToMarkdown(imageId, width) {
        const textarea = this.editor.textarea;
        const content = textarea.value;

        // Matches ![alt](image:<id>) or an already-resized
        // ![alt](image:<id>:<oldWidth>), replacing only the id/width portion.
        const regex = new RegExp(`(!\\[[^\\]]*\\]\\(image:${imageId})(?::\\d+)?(\\))`);
        if (!regex.test(content)) return;

        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;

        textarea.value = content.replace(regex, `$1:${width}$2`);
        textarea.selectionStart = selectionStart;
        textarea.selectionEnd = selectionEnd;

        this.editor.handleInput();
    }
}
