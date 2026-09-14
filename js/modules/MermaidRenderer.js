/**
 * MermaidRenderer Module
 * Handles Mermaid diagram rendering
 */

export class MermaidRenderer {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    /**
     * Initialize Mermaid
     */
    init() {
        if (typeof window.mermaid === 'undefined') {
            console.error('Mermaid library not loaded');
            return;
        }

        try {
            // Initialize mermaid with configuration
            window.mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                fontFamily: 'inherit',
                logLevel: 'error',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis'
                },
                sequence: {
                    useMaxWidth: true,
                    diagramMarginX: 50,
                    diagramMarginY: 10
                },
                gantt: {
                    useMaxWidth: true
                }
            });

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize Mermaid:', error);
        }
    }

    /**
     * Render all mermaid diagrams in a container
     * @param {HTMLElement} container - Container element with mermaid divs
     */
    async renderDiagrams(container) {
        if (!this.isInitialized) {
            console.error('Mermaid not initialized');
            return;
        }

        // Find all unprocessed mermaid divs
        const mermaidDivs = container.querySelectorAll('.mermaid[data-processed="false"]');

        if (mermaidDivs.length === 0) {
            return;
        }

        // Process each diagram
        for (let i = 0; i < mermaidDivs.length; i++) {
            const div = mermaidDivs[i];
            await this.renderSingleDiagram(div, i);
        }
    }

    /**
     * Render a single mermaid diagram
     * @param {HTMLElement} element - Mermaid div element
     * @param {number} index - Diagram index
     */
    async renderSingleDiagram(element, index) {
        try {
            // Get the original code - either from stored data attribute or from textContent
            let code;
            if (element.dataset.mermaidCode) {
                // Use stored code for re-rendering
                code = element.dataset.mermaidCode;
            } else {
                // First time rendering - store the original code
                code = element.textContent.trim();
                element.dataset.mermaidCode = code;
            }

            const id = `mermaid-diagram-${Date.now()}-${index}`;

            // Render the diagram
            const { svg } = await window.mermaid.render(id, code);

            // Replace text content with rendered SVG
            element.innerHTML = svg;
            element.setAttribute('data-processed', 'true');

        } catch (error) {
            console.error('Mermaid rendering error:', error);
            
            // Display error message in the diagram div
            element.innerHTML = `
                <div class="mermaid-error" style="
                    padding: 1rem;
                    background-color: #fee;
                    border: 1px solid #fcc;
                    border-radius: 0.25rem;
                    color: #c00;
                ">
                    <strong>Mermaid Diagram Error:</strong>
                    <pre style="margin-top: 0.5rem; white-space: pre-wrap;">${this.escapeHtml(error.message)}</pre>
                </div>
            `;
            element.setAttribute('data-processed', 'true');
        }
    }

    /**
     * Re-render all diagrams (useful after theme change)
     * @param {HTMLElement} container - Container element
     */
    async reRenderAll(container) {
        // Reset all diagrams to unprocessed and clear their content
        const allDiagrams = container.querySelectorAll('.mermaid');
        allDiagrams.forEach(div => {
            // Clear the rendered SVG content but keep the original code in data attribute
            if (div.dataset.mermaidCode) {
                div.textContent = div.dataset.mermaidCode;
            }
            div.setAttribute('data-processed', 'false');
        });

        // Re-render
        await this.renderDiagrams(container);
    }

    /**
     * Update Mermaid theme
     * @param {string} theme - Theme name ('default', 'dark', 'forest', 'neutral')
     */
    updateTheme(theme) {
        if (!this.isInitialized) return;

        const mermaidThemeMap = {
            'modern': 'default',
            'classic': 'neutral',
            'minimal': 'base'
        };

        const mermaidTheme = mermaidThemeMap[theme] || 'default';

        try {
            window.mermaid.initialize({
                theme: mermaidTheme
            });
        } catch (error) {
            console.error('Failed to update Mermaid theme:', error);
        }
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
}
