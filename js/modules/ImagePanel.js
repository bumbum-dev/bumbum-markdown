/**
 * ImagePanel Module
 * UI component for managing uploaded images
 */

import retroDialog from '../retro/RetroDialog.js';

export class ImagePanel {
    constructor(imageManager, editor) {
        this.imageManager = imageManager;
        this.editor = editor;
        this.panel = null;
        this.overlay = null;
        this.isOpen = false;
        this.pendingUploads = [];
        this.insertPosition = null;
        
        this.init();
    }

    /**
     * Initialize the image panel
     */
    init() {
        this.createPanel();
        this.setupEventListeners();
    }

    /**
     * Create the image panel HTML structure
     */
    createPanel() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'image-panel-overlay';
        this.overlay.className = 'image-panel-overlay';
        this.overlay.style.display = 'none';
        document.body.appendChild(this.overlay);

        // Create panel
        this.panel = document.createElement('div');
        this.panel.id = 'image-panel';
        this.panel.className = 'image-panel';
        this.panel.innerHTML = `
            <div class="image-panel-header">
                <h2>📷 Image Library</h2>
                <button class="image-panel-close" aria-label="Close image panel">×</button>
            </div>
            
            <div class="image-panel-toolbar">
                <button class="btn-upload" title="Upload images">
                    <span>📤 Upload</span>
                    <input type="file" accept="image/*" multiple style="display: none;">
                </button>
                <button class="btn-export" title="Export library">💾 Export</button>
                <button class="btn-import" title="Import library">
                    📥 Import
                    <input type="file" accept=".json" style="display: none;">
                </button>
                <div class="storage-indicator">
                    <span class="storage-text">Loading...</span>
                    <div class="storage-bar">
                        <div class="storage-bar-fill" style="width: 0%"></div>
                    </div>
                </div>
            </div>

            <div class="image-panel-content">
                <div class="image-grid" id="image-grid">
                    <div class="image-grid-empty">
                        <p>📷</p>
                        <p>No images uploaded yet</p>
                        <p class="hint">Click Upload or drag & drop images here</p>
                    </div>
                </div>
                
                <div class="drop-zone" id="drop-zone" style="display: none;">
                    <div class="drop-zone-content">
                        <p>📤</p>
                        <p>Drop images here</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.panel);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = this.panel.querySelector('.image-panel-close');
        closeBtn.addEventListener('click', () => this.close());

        // Overlay click to close
        this.overlay.addEventListener('click', () => this.close());

        // Upload button
        const uploadBtn = this.panel.querySelector('.btn-upload');
        const fileInput = uploadBtn.querySelector('input[type="file"]');
        
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
            e.target.value = ''; // Reset input
        });

        // Export button
        const exportBtn = this.panel.querySelector('.btn-export');
        exportBtn.addEventListener('click', () => this.exportLibrary());

        // Import button
        const importBtn = this.panel.querySelector('.btn-import');
        const importInput = importBtn.querySelector('input[type="file"]');
        
        importBtn.addEventListener('click', () => {
            importInput.click();
        });
        
        importInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importLibrary(e.target.files[0]);
            }
            e.target.value = ''; // Reset input
        });

        // Drag and drop
        const dropZone = this.panel.querySelector('#drop-zone');
        const content = this.panel.querySelector('.image-panel-content');

        content.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.display = 'flex';
        });

        content.addEventListener('dragleave', (e) => {
            if (e.target === content) {
                dropZone.style.display = 'none';
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.display = 'none';
            
            const files = Array.from(e.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            
            if (files.length > 0) {
                this.handleFileSelect(files);
            }
        });
    }

    /**
     * Handle file selection
     * @param {FileList|Array} files - Selected files
     */
    async handleFileSelect(files) {
        let fileArray = Array.from(files);

        if (fileArray.length === 0) return;

        // Reject invalid files upfront so users aren't offered a compression
        // dialog for a file that's about to be turned away anyway.
        const rejected = [];
        fileArray = fileArray.filter(file => {
            try {
                this.imageManager.validateFile(file);
                return true;
            } catch (error) {
                rejected.push({ file, error });
                return false;
            }
        });

        for (const { file, error } of rejected) {
            this.showNotification(`Skipped ${file.name}: ${error.message}`, 'error');
        }

        if (fileArray.length === 0) return;

        // Check if compression is needed
        const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
        const stats = await this.imageManager.getStorageStats();
        
        // Show compression dialog if files are large
        if (totalSize > 5 * 1024 * 1024) { // > 5MB
            this.showCompressionDialog(fileArray, totalSize, stats);
        } else {
            // Upload without dialog for small files
            await this.uploadFiles(fileArray, true);
        }
    }

    /**
     * Show compression dialog
     * @param {Array} files - Files to upload
     * @param {number} totalSize - Total size in bytes
     * @param {Object} stats - Storage stats
     */
    showCompressionDialog(files, totalSize, stats) {
        const estimatedCompressed = totalSize * 0.35; // Estimate 65% reduction
        const remainingSpace = stats.total - stats.used;
        
        const dialog = document.createElement('div');
        dialog.className = 'compression-dialog';
        dialog.innerHTML = `
            <div class="compression-dialog-content">
                <h3>Image Upload</h3>
                <p class="file-info">${files.length} image${files.length > 1 ? 's' : ''} selected (${this.imageManager.formatSize(totalSize)})</p>
                
                <div class="compression-info">
                    <p class="warning-icon">⚠️</p>
                    <p>Images are large. Would you like to compress them?</p>
                </div>
                
                <div class="storage-info">
                    <div class="info-row">
                        <span>Recommended compression:</span>
                        <span class="highlight">${this.imageManager.formatSize(totalSize)} → ${this.imageManager.formatSize(estimatedCompressed)} (${Math.round((1 - estimatedCompressed/totalSize) * 100)}% saving)</span>
                    </div>
                    <div class="info-row">
                        <span>Available storage:</span>
                        <span>${this.imageManager.formatSize(remainingSpace)}</span>
                    </div>
                    <div class="info-row">
                        <span>After upload (compressed):</span>
                        <span class="${stats.used + estimatedCompressed < stats.total ? 'success' : 'error'}">
                            ${this.imageManager.formatSize(stats.used + estimatedCompressed)} / ${this.imageManager.formatSize(stats.total)}
                        </span>
                    </div>
                    <div class="info-row">
                        <span>After upload (original):</span>
                        <span class="${stats.used + totalSize < stats.total ? 'success' : 'error'}">
                            ${this.imageManager.formatSize(stats.used + totalSize)} / ${this.imageManager.formatSize(stats.total)}
                        </span>
                    </div>
                </div>
                
                <div class="dialog-actions">
                    <button class="btn btn-primary compress-btn">Compress (Recommended)</button>
                    <button class="btn btn-secondary original-btn">Upload Original Size</button>
                    <button class="btn btn-cancel cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Event listeners
        dialog.querySelector('.compress-btn').addEventListener('click', () => {
            document.body.removeChild(dialog);
            this.uploadFiles(files, true);
        });
        
        dialog.querySelector('.original-btn').addEventListener('click', () => {
            document.body.removeChild(dialog);
            this.uploadFiles(files, false);
        });
        
        dialog.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
    }

    /**
     * Upload files to IndexedDB
     * @param {Array} files - Files to upload
     * @param {boolean} compress - Whether to compress
     */
    async uploadFiles(files, compress) {
        let uploadedCount = 0;

        // Show progress
        this.showUploadProgress(files.length);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                await this.imageManager.uploadImage(file, compress);
                uploadedCount++;
                this.updateUploadProgress(i + 1, files.length);

            } catch (error) {
                console.error('Failed to upload image:', file.name, error);
                this.showNotification(`Failed to upload ${file.name}: ${error.message}`, 'error');
            }
        }

        this.hideUploadProgress();

        // Refresh the grid
        await this.refreshGrid();

        // Update storage stats
        await this.updateStorageIndicator();

        if (uploadedCount > 0) {
            this.showNotification(
                `✅ Added ${uploadedCount} image${uploadedCount > 1 ? 's' : ''} to library`,
                'success'
            );
        }
    }

    /**
     * Refresh the image grid
     */
    async refreshGrid() {
        const grid = this.panel.querySelector('#image-grid');
        const images = await this.imageManager.getAllImages();
        
        if (images.length === 0) {
            grid.innerHTML = `
                <div class="image-grid-empty">
                    <p>📷</p>
                    <p>No images uploaded yet</p>
                    <p class="hint">Click Upload or drag & drop images here</p>
                </div>
            `;
            return;
        }
        
        // Sort by upload date (newest first)
        images.sort((a, b) => b.uploadDate - a.uploadDate);
        
        grid.innerHTML = images.map(img => `
            <div class="image-item" data-id="${img.id}">
                <div class="image-thumbnail">
                    <img src="${img.data}" alt="${img.filename}">
                </div>
                <div class="image-info">
                    <p class="image-filename" title="${img.filename}">${this.truncateFilename(img.filename, 20)}</p>
                    <p class="image-size">${this.imageManager.formatSize(img.size)}</p>
                    ${img.compressed ? '<span class="badge-compressed">Compressed</span>' : ''}
                </div>
                <div class="image-actions">
                    <button class="btn-insert" data-id="${img.id}" title="Insert into document">
                        Insert
                    </button>
                    <button class="btn-copy" data-id="${img.id}" title="Copy reference">
                        📋
                    </button>
                    <button class="btn-delete" data-id="${img.id}" title="Delete image">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to action buttons
        grid.querySelectorAll('.btn-insert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.insertImageAtCursor(id);
            });
        });
        
        grid.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.copyImageReference(id);
            });
        });
        
        grid.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.deleteImage(id);
            });
        });
    }

    /**
     * Insert image reference at cursor position
     * @param {string} imageId - Image ID
     */
    async insertImageAtCursor(imageId) {
        const image = await this.imageManager.getImage(imageId);
        if (!image) return;
        
        const reference = `![${image.filename}](image:${imageId})`;

        const textarea = this.editor.textarea;
        const start = this.insertPosition !== null ? this.insertPosition : textarea.selectionStart;
        const end = this.insertPosition !== null ? this.insertPosition : textarea.selectionEnd;
        const content = textarea.value;

        textarea.value = content.substring(0, start) + reference + content.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + reference.length;
        this.insertPosition = null;

        // Trigger update
        this.editor.handleInput();
        textarea.focus();
        
        this.showNotification('Image reference inserted', 'success');
    }

    /**
     * Copy image reference to clipboard
     * @param {string} imageId - Image ID
     */
    async copyImageReference(imageId) {
        const image = await this.imageManager.getImage(imageId);
        if (!image) return;
        
        const reference = `![${image.filename}](image:${imageId})`;
        
        try {
            await navigator.clipboard.writeText(reference);
            this.showNotification('Reference copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showNotification('Failed to copy reference', 'error');
        }
    }

    /**
     * Delete image
     * @param {string} imageId - Image ID
     */
    async deleteImage(imageId) {
        if (!await retroDialog.confirm('Are you sure you want to delete this image?', 'Delete Image')) {
            return;
        }
        
        try {
            await this.imageManager.deleteImage(imageId);
            await this.refreshGrid();
            await this.updateStorageIndicator();
            this.showNotification('Image deleted', 'success');
        } catch (error) {
            console.error('Failed to delete image:', error);
            this.showNotification('Failed to delete image', 'error');
        }
    }

    /**
     * Update storage indicator
     */
    async updateStorageIndicator() {
        const stats = await this.imageManager.getStorageStats();
        const indicator = this.panel.querySelector('.storage-indicator');
        const text = indicator.querySelector('.storage-text');
        const fill = indicator.querySelector('.storage-bar-fill');
        
        text.textContent = `${this.imageManager.formatSize(stats.used)} / ${this.imageManager.formatSize(stats.total)} (${stats.images} images)`;
        fill.style.width = `${Math.min(stats.percentage, 100)}%`;
        
        // Change color based on usage
        if (stats.percentage > 90) {
            fill.style.background = '#ef4444';
        } else if (stats.percentage > 80) {
            fill.style.background = '#f59e0b';
        } else {
            fill.style.background = '#10b981';
        }
    }

    /**
     * Export image library
     */
    async exportLibrary() {
        try {
            const jsonData = await this.imageManager.exportLibrary();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `markdown-images-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.showNotification('Library exported successfully', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('Failed to export library', 'error');
        }
    }

    /**
     * Import image library
     * @param {File} file - JSON file to import
     */
    async importLibrary(file) {
        try {
            const text = await file.text();
            const result = await this.imageManager.importLibrary(text);
            
            await this.refreshGrid();
            await this.updateStorageIndicator();
            
            this.showNotification(
                `Imported ${result.imported} images (${result.skipped} skipped)`, 
                'success'
            );
        } catch (error) {
            console.error('Import failed:', error);
            this.showNotification('Failed to import library', 'error');
        }
    }

    /**
     * Show upload progress indicator
     * @param {number} total - Total files to upload
     */
    showUploadProgress(total) {
        const existing = document.querySelector('.upload-progress');
        if (existing) existing.remove();
        
        const progress = document.createElement('div');
        progress.className = 'upload-progress';
        progress.innerHTML = `
            <div class="upload-progress-content">
                <p>Uploading images...</p>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: 0%"></div>
                </div>
                <p class="progress-text">0 / ${total}</p>
            </div>
        `;
        
        document.body.appendChild(progress);
    }

    /**
     * Update upload progress
     * @param {number} current - Current file number
     * @param {number} total - Total files
     */
    updateUploadProgress(current, total) {
        const progress = document.querySelector('.upload-progress');
        if (!progress) return;
        
        const fill = progress.querySelector('.progress-bar-fill');
        const text = progress.querySelector('.progress-text');
        
        const percentage = (current / total) * 100;
        fill.style.width = `${percentage}%`;
        text.textContent = `${current} / ${total}`;
    }

    /**
     * Hide upload progress indicator
     */
    hideUploadProgress() {
        setTimeout(() => {
            const progress = document.querySelector('.upload-progress');
            if (progress) {
                progress.remove();
            }
        }, 500);
    }

    /**
     * Truncate filename for display
     * @param {string} filename - Filename to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string}
     */
    truncateFilename(filename, maxLength) {
        if (filename.length <= maxLength) return filename;
        
        const ext = filename.split('.').pop();
        const name = filename.substring(0, filename.length - ext.length - 1);
        const truncated = name.substring(0, maxLength - ext.length - 4) + '...';
        
        return truncated + '.' + ext;
    }

    /**
     * Show notification
     * @param {string} message - Message to display
     * @param {string} type - Notification type
     */
    showNotification(message, type = 'info') {
        if (type !== 'error') return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Open the image panel
     */
    async open() {
        this.isOpen = true;
        this.panel.classList.add('open');
        this.overlay.style.display = 'block';
        
        // Refresh grid and stats
        await this.refreshGrid();
        await this.updateStorageIndicator();
    }

    /**
     * Close the image panel
     */
    close() {
        this.isOpen = false;
        this.panel.classList.remove('open');
        this.overlay.style.display = 'none';
    }

    /**
     * Toggle the image panel
     */
    async toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            await this.open();
        }
    }
}
