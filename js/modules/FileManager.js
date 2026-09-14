/**
 * FileManager Module
 * Handles file upload, save/load, templates, and project management
 */

import retroDialog from '../retro/RetroDialog.js';
import * as Storage from './Storage.js';

export class FileManager {
    constructor(editor) {
        this.editor = editor;
        this.currentProject = null;
        this.autoSaveEnabled = true;
        this.autoSaveTimer = null;
        
        this.init();
    }

    /**
     * Initialize FileManager
     */
    init() {
        this.setupDragAndDrop();
        this.setupFileInput();
        this.setupButtons();
        this.loadAutoSavedProject();
        this.setupAutoSave();
    }

    /**
     * Set up drag and drop functionality
     */
    setupDragAndDrop() {
        const editorTextarea = document.getElementById('markdown-editor');
        if (!editorTextarea) return;

        // Prevent default drag behaviors on the whole document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Highlight drop zone
        ['dragenter', 'dragover'].forEach(eventName => {
            editorTextarea.addEventListener(eventName, () => {
                editorTextarea.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            editorTextarea.addEventListener(eventName, () => {
                editorTextarea.classList.remove('drag-over');
            }, false);
        });

        // Handle drop
        editorTextarea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        }, false);
    }

    /**
     * Set up file input for traditional file selection
     */
    setupFileInput() {
        const fileInput = document.getElementById('file-input');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            this.handleFiles(files);
            // Reset input so same file can be selected again
            fileInput.value = '';
        });
    }

    /**
     * Set up button handlers
     */
    setupButtons() {
        // Open file button
        const openButton = document.getElementById('file-open');
        if (openButton) {
            openButton.addEventListener('click', () => {
                const fileInput = document.getElementById('file-input');
                if (fileInput) fileInput.click();
            });
        }

        // Save button
        const saveButton = document.getElementById('file-save');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveToLocalStorage();
            });
        }

        // Load button
        const loadButton = document.getElementById('file-load');
        if (loadButton) {
            loadButton.addEventListener('click', () => {
                this.showLoadDialog();
            });
        }

        // Clear button
        const clearButton = document.getElementById('file-clear');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearEditor();
            });
        }

        // Export markdown button
        const exportButton = document.getElementById('file-export');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.exportMarkdown();
            });
        }
    }

    /**
     * Handle uploaded files
     * @param {FileList} files - Files to process
     */
    async handleFiles(files) {
        if (files.length === 0) return;

        const file = files[0];

        // Only accept markdown files
        if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
            this.showNotification('Please select a Markdown file (.md or .markdown)', 'error');
            return;
        }

        try {
            const content = await this.readFile(file);
            this.editor.setContent(content);
            this.currentProject = {
                name: file.name.replace(/\.(md|markdown)$/, ''),
                content: content,
                lastModified: new Date().toISOString()
            };
            this.showNotification(`Loaded: ${file.name}`, 'success');
        } catch (error) {
            console.error('Error reading file:', error);
            this.showNotification('Failed to read file', 'error');
        }
    }

    /**
     * Read file content
     * @param {File} file - File to read
     * @returns {Promise<string>} File content
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Save current project to localStorage
     */
    async saveToLocalStorage() {
        const content = this.editor.getContent();

        if (!content || content.trim().length === 0) {
            this.showNotification('Nothing to save', 'warning');
            return;
        }

        // Get project name from user or use default
        const projectName = await retroDialog.prompt('Enter project name:', 'Save Project', this.currentProject?.name || 'My Project');

        if (!projectName) return;

        const project = {
            name: projectName,
            content: content,
            lastModified: new Date().toISOString(),
            settings: this.getSettingsSnapshot()
        };

        // Get existing projects
        const projects = this.getSavedProjects();
        
        // Add or update project
        const existingIndex = projects.findIndex(p => p.name === projectName);
        if (existingIndex >= 0) {
            projects[existingIndex] = project;
        } else {
            projects.push(project);
        }

        // Save to localStorage
        Storage.setItem('markdown_pdf_projects', projects);
        this.currentProject = project;

        this.showNotification(`Project "${projectName}" saved`, 'success');
    }

    /**
     * Get all saved projects from localStorage
     * @returns {Array} Saved projects
     */
    getSavedProjects() {
        return Storage.getItem('markdown_pdf_projects', []);
    }

    /**
     * Show load project dialog
     */
    showLoadDialog() {
        const projects = this.getSavedProjects();

        if (projects.length === 0) {
            this.showNotification('No saved projects found', 'info');
            return;
        }

        // Create dialog
        const dialog = this.createDialog('Load Project', () => {
            const projectList = document.createElement('div');
            projectList.className = 'project-list';

            projects.forEach((project, index) => {
                const projectItem = document.createElement('div');
                projectItem.className = 'project-item';
                
                const lastModified = new Date(project.lastModified).toLocaleString();

                projectItem.innerHTML = `
                    <div class="project-info">
                        <h4></h4>
                        <p>Last modified: ${lastModified}</p>
                    </div>
                    <div class="project-actions">
                        <button class="btn-load" data-index="${index}">Load</button>
                        <button class="btn-delete" data-index="${index}">Delete</button>
                    </div>
                `;
                projectItem.querySelector('h4').textContent = project.name;

                projectList.appendChild(projectItem);
            });

            // Add event listeners
            projectList.querySelectorAll('.btn-load').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.index);
                    this.loadProject(projects[index]);
                    this.closeDialog(dialog);
                });
            });

            projectList.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const index = parseInt(btn.dataset.index);
                    if (await retroDialog.confirm(`Delete project "${projects[index].name}"?`, 'Delete Project')) {
                        this.deleteProject(projects[index].name);
                        this.closeDialog(dialog);
                        this.showLoadDialog();
                    }
                });
            });

            return projectList;
        });

        document.body.appendChild(dialog);
    }

    /**
     * Load a project
     * @param {Object} project - Project to load
     */
    loadProject(project) {
        this.editor.setContent(project.content);
        this.currentProject = project;

        // Restore settings if saved
        if (project.settings && window.markdownPDFApp?.settingsManager) {
            window.markdownPDFApp.settingsManager.loadSettings(project.settings);
        }

        this.showNotification(`Loaded: ${project.name}`, 'success');
    }

    /**
     * Delete a project
     * @param {string} projectName - Name of project to delete
     */
    deleteProject(projectName) {
        const projects = this.getSavedProjects();
        const filtered = projects.filter(p => p.name !== projectName);
        Storage.setItem('markdown_pdf_projects', filtered);
        this.showNotification(`Deleted: ${projectName}`, 'success');
    }

    /**
     * Clear editor content
     */
    async clearEditor() {
        if (await retroDialog.confirm('Clear all content? This cannot be undone.', 'Clear Editor')) {
            this.editor.setContent('');
            this.currentProject = null;
            Storage.removeItem('markdown_pdf_autosave');
            this.showNotification('Editor cleared', 'info');
        }
    }

    /**
     * Export markdown content as .md file
     */
    exportMarkdown() {
        const content = this.editor.getContent();
        
        if (!content || content.trim().length === 0) {
            this.showNotification('Nothing to export', 'warning');
            return;
        }

        const filename = (this.currentProject?.name || 'document') + '.md';
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification(`Exported: ${filename}`, 'success');
    }

    /**
     * Set up auto-save functionality
     */
    setupAutoSave() {
        // Listen for content changes
        const editorTextarea = document.getElementById('markdown-editor');
        if (!editorTextarea) return;

        editorTextarea.addEventListener('input', () => {
            this.scheduleAutoSave();
        });
    }

    /**
     * Schedule auto-save
     */
    scheduleAutoSave() {
        if (!this.autoSaveEnabled) return;

        // Clear existing timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Schedule save for 2 seconds after last change
        this.autoSaveTimer = setTimeout(() => {
            this.autoSave();
        }, 2000);
    }

    /**
     * Perform auto-save
     */
    autoSave() {
        const content = this.editor.getContent();
        
        if (!content || content.trim().length === 0) {
            return;
        }

        const autoSaveData = {
            content: content,
            timestamp: new Date().toISOString(),
            settings: this.getSettingsSnapshot()
        };

        Storage.setItem('markdown_pdf_autosave', autoSaveData);
    }

    /**
     * Load auto-saved project
     */
    loadAutoSavedProject() {
        try {
            const autoSave = Storage.getItem('markdown_pdf_autosave');
            if (!autoSave) return;

            const timestamp = new Date(autoSave.timestamp);
            const now = new Date();
            const hoursSince = (now - timestamp) / (1000 * 60 * 60);

            // Only restore if less than 24 hours old
            if (hoursSince < 24) {
                this.editor.setContent(autoSave.content);
                
                // Restore settings if available
                if (autoSave.settings && window.markdownPDFApp?.settingsManager) {
                    window.markdownPDFApp.settingsManager.loadSettings(autoSave.settings);
                }

                this.showNotification('Restored auto-saved content', 'info');
            }
        } catch (error) {
            console.error('Error loading auto-save:', error);
        }
    }

    /**
     * Get current settings snapshot
     * @returns {Object} Current settings
     */
    getSettingsSnapshot() {
        if (window.markdownPDFApp?.settingsManager) {
            return window.markdownPDFApp.settingsManager.getSettings();
        }
        return {};
    }

    /**
     * Create a dialog element
     * @param {string} title - Dialog title
     * @param {Function} contentBuilder - Function that returns dialog content
     * @returns {HTMLElement} Dialog element
     */
    createDialog(title, contentBuilder) {
        const dialog = document.createElement('div');
        dialog.className = 'file-dialog';
        
        const dialogContent = document.createElement('div');
        dialogContent.className = 'file-dialog-content';
        
        dialogContent.innerHTML = `
            <div class="file-dialog-header">
                <h3>${title}</h3>
                <button class="file-dialog-close">×</button>
            </div>
            <div class="file-dialog-body"></div>
        `;

        const body = dialogContent.querySelector('.file-dialog-body');
        body.appendChild(contentBuilder());

        dialog.appendChild(dialogContent);

        // Close button handler
        const closeBtn = dialogContent.querySelector('.file-dialog-close');
        closeBtn.addEventListener('click', () => {
            this.closeDialog(dialog);
        });

        // Close on overlay click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.closeDialog(dialog);
            }
        });

        return dialog;
    }

    /**
     * Close and remove dialog
     * @param {HTMLElement} dialog - Dialog to close
     */
    closeDialog(dialog) {
        dialog.style.opacity = '0';
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        }, 300);
    }

    /**
     * Show notification
     * @param {string} message - Message to display
     * @param {string} type - Notification type
     */
    showNotification(message, type) {
        if (window.markdownPDFApp?.showNotification) {
            window.markdownPDFApp.showNotification(message, type);
        }
    }
}
