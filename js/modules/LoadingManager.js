/**
 * LoadingManager Module
 * Manages all loading states and indicators throughout the application
 */

export class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
        this.createLoadingOverlay();
        this.createProcessingIndicator();
    }

    /**
     * Create global loading overlay
     */
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.id = 'global-loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">Loading...</div>
                <div class="loading-subtext"></div>
                <div class="loading-progress">
                    <div class="loading-progress-bar" style="width: 0%"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    /**
     * Create processing indicator for background tasks
     */
    createProcessingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'processing-indicator';
        indicator.id = 'processing-indicator';
        indicator.innerHTML = `
            <div class="processing-icon"></div>
            <div class="processing-text">Processing...</div>
        `;
        document.body.appendChild(indicator);
    }

    /**
     * Show global loading overlay
     * @param {string} message - Main loading message
     * @param {string} subtext - Additional context (optional)
     */
    showLoading(message = 'Loading...', subtext = '') {
        const overlay = document.getElementById('global-loading-overlay');
        if (!overlay) return;

        const textElement = overlay.querySelector('.loading-text');
        const subtextElement = overlay.querySelector('.loading-subtext');

        if (textElement) textElement.textContent = message;
        if (subtextElement) subtextElement.textContent = subtext;

        overlay.classList.add('active');
        this.activeLoaders.add('global');
    }

    /**
     * Hide global loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('global-loading-overlay');
        if (!overlay) return;

        overlay.classList.remove('active');
        this.activeLoaders.delete('global');
        
        // Reset progress bar
        const progressBar = overlay.querySelector('.loading-progress-bar');
        if (progressBar) {
            progressBar.style.width = '0%';
        }
    }

    /**
     * Update loading progress
     * @param {number} percent - Progress percentage (0-100)
     */
    updateProgress(percent) {
        const overlay = document.getElementById('global-loading-overlay');
        if (!overlay) return;

        const progressBar = overlay.querySelector('.loading-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }

    /**
     * Show processing indicator
     * @param {string} message - Processing message
     */
    showProcessing(message = 'Processing...') {
        const indicator = document.getElementById('processing-indicator');
        if (!indicator) return;

        const textElement = indicator.querySelector('.processing-text');
        if (textElement) textElement.textContent = message;

        indicator.classList.add('active');
        this.activeLoaders.add('processing');
    }

    /**
     * Hide processing indicator
     */
    hideProcessing() {
        const indicator = document.getElementById('processing-indicator');
        if (!indicator) return;

        indicator.classList.remove('active');
        this.activeLoaders.delete('processing');
    }

    /**
     * Add loading state to a button
     * @param {HTMLElement} button - Button element
     * @param {string} originalText - Original button text to restore later
     */
    setButtonLoading(button, originalText = null) {
        if (!button) return;

        // Store original text if not provided
        if (!originalText) {
            button.dataset.originalText = button.textContent;
        } else {
            button.dataset.originalText = originalText;
        }

        button.classList.add('btn-loading');
        button.disabled = true;
    }

    /**
     * Remove loading state from a button
     * @param {HTMLElement} button - Button element
     */
    removeButtonLoading(button) {
        if (!button) return;

        button.classList.remove('btn-loading');
        button.disabled = false;

        // Restore original text if stored
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }

    /**
     * Add loading state to a panel
     * @param {HTMLElement} panel - Panel element
     */
    setPanelLoading(panel) {
        if (!panel) return;
        panel.classList.add('panel-loading');
        this.activeLoaders.add(`panel-${panel.id}`);
    }

    /**
     * Remove loading state from a panel
     * @param {HTMLElement} panel - Panel element
     */
    removePanelLoading(panel) {
        if (!panel) return;
        panel.classList.remove('panel-loading');
        this.activeLoaders.delete(`panel-${panel.id}`);
    }

    /**
     * Show skeleton loading in an element
     * @param {HTMLElement} element - Container element
     * @param {number} lines - Number of skeleton lines to show
     */
    showSkeleton(element, lines = 3) {
        if (!element) return;

        const skeletonHTML = `
            <div class="skeleton skeleton-heading"></div>
            ${Array(lines).fill('<div class="skeleton skeleton-paragraph"></div>').join('')}
        `;

        element.innerHTML = skeletonHTML;
    }

    /**
     * Execute an async operation with loading indicator
     * @param {Function} operation - Async function to execute
     * @param {Object} options - Loading options
     * @returns {Promise} Result of the operation
     */
    async withLoading(operation, options = {}) {
        const {
            message = 'Loading...',
            subtext = '',
            showProgress = false,
            button = null,
            panel = null
        } = options;

        try {
            // Show appropriate loading indicators
            if (button) {
                this.setButtonLoading(button);
            }

            if (panel) {
                this.setPanelLoading(panel);
            }

            if (!button && !panel) {
                this.showLoading(message, subtext);
            }

            // Execute operation
            const result = await operation((percent) => {
                if (showProgress) {
                    this.updateProgress(percent);
                }
            });

            return result;

        } catch (error) {
            console.error('Operation failed:', error);
            throw error;

        } finally {
            // Hide all loading indicators
            if (button) {
                this.removeButtonLoading(button);
            }

            if (panel) {
                this.removePanelLoading(panel);
            }

            if (!button && !panel) {
                this.hideLoading();
            }
        }
    }

    /**
     * Execute multiple operations with a shared loading state
     * @param {Array<Function>} operations - Array of async functions
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Results of all operations
     */
    async withLoadingMultiple(operations, options = {}) {
        const {
            message = 'Loading...',
            showProgress = true
        } = options;

        this.showLoading(message);

        try {
            const results = [];
            const total = operations.length;

            for (let i = 0; i < operations.length; i++) {
                const result = await operations[i]();
                results.push(result);

                if (showProgress) {
                    const percent = ((i + 1) / total) * 100;
                    this.updateProgress(percent);
                }
            }

            return results;

        } finally {
            this.hideLoading();
        }
    }

    /**
     * Check if any loading is active
     * @returns {boolean} True if any loader is active
     */
    isLoading() {
        return this.activeLoaders.size > 0;
    }

    /**
     * Clear all loading states (emergency cleanup)
     */
    clearAll() {
        this.hideLoading();
        this.hideProcessing();
        
        // Remove all panel loading states
        document.querySelectorAll('.panel-loading').forEach(panel => {
            panel.classList.remove('panel-loading');
        });

        // Remove all button loading states
        document.querySelectorAll('.btn-loading').forEach(button => {
            this.removeButtonLoading(button);
        });

        this.activeLoaders.clear();
    }

    /**
     * Create a custom loading indicator
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Customization options
     * @returns {HTMLElement} Loading element
     */
    createCustomLoader(container, options = {}) {
        const {
            size = 'medium',
            message = '',
            inline = false
        } = options;

        const loader = document.createElement('div');
        loader.className = `custom-loader ${inline ? 'inline' : ''}`;
        
        const spinnerSize = size === 'small' ? '20px' : size === 'large' ? '60px' : '40px';
        
        loader.innerHTML = `
            <div class="spinner" style="width: ${spinnerSize}; height: ${spinnerSize};"></div>
            ${message ? `<div class="loading-text">${message}</div>` : ''}
        `;

        if (container) {
            container.appendChild(loader);
        }

        return loader;
    }

    /**
     * Remove custom loading indicator
     * @param {HTMLElement} loader - Loader element to remove
     */
    removeCustomLoader(loader) {
        if (loader && loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
    }
}
