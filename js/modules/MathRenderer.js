/**
 * MathRenderer Module
 * Handles LaTeX/KaTeX math rendering
 */

export class MathRenderer {
    constructor() {
        this.isInitialized = typeof window.renderMathInElement !== 'undefined';
        if (!this.isInitialized) {
            console.error('KaTeX auto-render not loaded');
        }
    }

    /**
     * Render all $...$ / $$...$$ math in a container in place.
     * @param {HTMLElement} container - Container element with rendered markdown
     */
    renderMath(container) {
        if (!this.isInitialized) return;

        try {
            window.renderMathInElement(container, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        } catch (error) {
            console.error('KaTeX rendering error:', error);
        }
    }
}
