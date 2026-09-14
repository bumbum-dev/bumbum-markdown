/**
 * ImageManager Module
 * Handles image storage in IndexedDB, compression, and retrieval
 */

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp'
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file

export class ImageManager {
    constructor() {
        this.dbName = 'markdown-pdf-images';
        this.storeName = 'images';
        this.dbVersion = 1;
        this.db = null;
        this.maxStorageMB = 50;
    }

    /**
     * Validate a file before it's compressed/stored
     * @param {File} file - File to validate
     * @throws {Error} If the file's type isn't an allowed image type or it exceeds the size ceiling
     */
    validateFile(file) {
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error(`File exceeds the ${this.formatSize(MAX_FILE_SIZE_BYTES)} size limit`);
        }
    }

    /**
     * Initialize IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    objectStore.createIndex('filename', 'filename', { unique: false });
                    objectStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                }
            };
        });
    }

    /**
     * Generate unique image ID
     * @returns {string}
     */
    generateId() {
        return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Compress image file
     * @param {File} file - Image file to compress
     * @param {number} maxWidth - Maximum width in pixels
     * @param {number} quality - JPEG quality (0-1)
     * @returns {Promise<{blob: Blob, wasCompressed: boolean, originalSize: number, newSize: number}>}
     */
    async compressImage(file, maxWidth = 1920, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.src = e.target.result;
            };

            reader.onerror = reject;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Calculate new dimensions
                let width = img.width;
                let height = img.height;
                let wasResized = false;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                    wasResized = true;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw image on canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Determine output format
                let mimeType = file.type;
                
                // Convert PNG to JPEG if no transparency (for better compression)
                if (file.type === 'image/png' && !this.hasTransparency(ctx, width, height)) {
                    mimeType = 'image/jpeg';
                }

                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        resolve({
                            blob: blob,
                            wasCompressed: wasResized || blob.size < file.size,
                            originalSize: file.size,
                            newSize: blob.size
                        });
                    },
                    mimeType,
                    mimeType === 'image/jpeg' ? quality : undefined
                );
            };

            img.onerror = reject;

            reader.readAsDataURL(file);
        });
    }

    /**
     * Check if image has transparency
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {boolean}
     */
    hasTransparency(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
                return true;
            }
        }
        return false;
    }

    /**
     * Convert blob to base64
     * @param {Blob} blob - Blob to convert
     * @returns {Promise<string>}
     */
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Upload image to IndexedDB
     * @param {File} file - Image file
     * @param {boolean} compress - Whether to compress the image
     * @returns {Promise<{id: string, filename: string, size: number, compressed: boolean}>}
     * @throws {Error} If the file fails type/size validation (see validateFile)
     */
    async uploadImage(file, compress = true) {
        this.validateFile(file);
        await this.init();

        let blob = file;
        let wasCompressed = false;
        let originalSize = file.size;
        let newSize = file.size;

        // Skip compression for SVG and GIF
        if (compress && !file.type.includes('svg') && !file.type.includes('gif')) {
            const compressed = await this.compressImage(file);
            if (compressed.wasCompressed) {
                blob = compressed.blob;
                wasCompressed = true;
                newSize = compressed.newSize;
            }
        }

        // Convert to base64
        const base64Data = await this.blobToBase64(blob);

        // Prepare image object
        const imageObj = {
            id: this.generateId(),
            filename: file.name,
            mimeType: blob.type,
            data: base64Data,
            uploadDate: Date.now(),
            size: newSize,
            compressed: wasCompressed,
            originalSize: originalSize
        };

        // Store in IndexedDB
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.add(imageObj);

            request.onsuccess = () => {
                resolve({
                    id: imageObj.id,
                    filename: imageObj.filename,
                    size: imageObj.size,
                    compressed: wasCompressed
                });
            };

            request.onerror = () => {
                reject(new Error('Failed to store image'));
            };
        });
    }

    /**
     * Get image by ID
     * @param {string} id - Image ID
     * @returns {Promise<Object|null>}
     */
    async getImage(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(new Error('Failed to retrieve image'));
            };
        });
    }

    /**
     * Get all images
     * @returns {Promise<Array>}
     */
    async getAllImages() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(new Error('Failed to retrieve images'));
            };
        });
    }

    /**
     * Delete image by ID
     * @param {string} id - Image ID
     * @returns {Promise<void>}
     */
    async deleteImage(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to delete image'));
            };
        });
    }

    /**
     * Get storage statistics
     * @returns {Promise<{used: number, total: number, percentage: number, images: number}>}
     */
    async getStorageStats() {
        const images = await this.getAllImages();
        const totalUsed = images.reduce((sum, img) => sum + img.size, 0);
        const totalMB = this.maxStorageMB * 1024 * 1024;

        return {
            used: totalUsed,
            total: totalMB,
            percentage: (totalUsed / totalMB) * 100,
            images: images.length
        };
    }

    /**
     * Format bytes to human-readable size
     * @param {number} bytes - Size in bytes
     * @returns {string}
     */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Export image library
     * @returns {Promise<string>} JSON string
     */
    async exportLibrary() {
        const images = await this.getAllImages();
        
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            images: images
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import image library
     * @param {string} jsonData - JSON string
     * @returns {Promise<{imported: number, skipped: number}>}
     */
    async importLibrary(jsonData) {
        await this.init();

        const data = JSON.parse(jsonData);
        
        if (!data.images || !Array.isArray(data.images)) {
            throw new Error('Invalid import data format');
        }

        let imported = 0;
        let skipped = 0;

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);

        for (const image of data.images) {
            // Check if image already exists
            const existing = await new Promise((resolve) => {
                const request = objectStore.get(image.id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });

            if (existing) {
                skipped++;
            } else {
                await new Promise((resolve, reject) => {
                    const request = objectStore.add(image);
                    request.onsuccess = () => {
                        imported++;
                        resolve();
                    };
                    request.onerror = reject;
                });
            }
        }

        return { imported, skipped };
    }

    /**
     * Find images matching filenames in markdown
     * @param {string} markdown - Markdown content
     * @returns {Promise<Map<string, string>>} Map of filename to image ID
     */
    async findMatchingImages(markdown) {
        const images = await this.getAllImages();
        const matches = new Map();

        // Extract all image references from markdown
        const imageRegex = /!\[.*?\]\((.*?)\)/g;
        const references = [];
        let match;

        while ((match = imageRegex.exec(markdown)) !== null) {
            references.push(match[1]);
        }

        // Try to match stored images with references
        for (const image of images) {
            const filename = image.filename;
            
            for (const ref of references) {
                // Check if reference ends with this filename
                if (ref.endsWith(filename) || ref.endsWith('/' + filename)) {
                    matches.set(ref, image.id);
                    break;
                }
            }
        }

        return matches;
    }
}
