/**
 * RetroDialog
 * Windows 95-style dialog boxes (alert, confirm, prompt)
 */

import { RetroWindow } from './RetroWindow.js';
import { RetroButton } from './RetroButton.js';

const DIALOG_ICONS = {
  info: `
    <svg viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="14" fill="var(--win95-blue)" stroke="var(--win95-black)" stroke-width="1.5"/>
      <text x="16" y="23" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="bold" fill="var(--win95-white)">i</text>
    </svg>`,
  question: `
    <svg viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="14" fill="var(--win95-blue)" stroke="var(--win95-black)" stroke-width="1.5"/>
      <text x="16" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="bold" fill="var(--win95-white)">?</text>
    </svg>`,
  warning: `
    <svg viewBox="0 0 32 32" width="32" height="32">
      <polygon points="16,3 30,28 2,28" fill="#ffff00" stroke="var(--win95-black)" stroke-width="1.5" stroke-linejoin="round"/>
      <text x="16" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="var(--win95-black)">!</text>
    </svg>`,
  error: `
    <svg viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="14" fill="#c00000" stroke="var(--win95-black)" stroke-width="1.5"/>
      <path d="M10 10 L22 22 M22 10 L10 22" stroke="var(--win95-white)" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
  edit: `
    <svg viewBox="0 0 32 32" width="32" height="32">
      <g transform="rotate(45 16 16)">
        <rect x="13" y="3" width="6" height="4" fill="#ff6666" stroke="var(--win95-black)" stroke-width="1"/>
        <rect x="13" y="7" width="6" height="17" fill="#ffcc00" stroke="var(--win95-black)" stroke-width="1"/>
        <polygon points="13,24 19,24 16,29" fill="#c98a2b" stroke="var(--win95-black)" stroke-width="1" stroke-linejoin="round"/>
      </g>
    </svg>`
};

class RetroDialog {
  constructor() {
    this.activeDialog = null;
    this.activeBackdrop = null;
    this.activeResolve = null;
  }

  getCenteredPosition(width, height) {
    return {
      initialX: Math.max(20, (window.innerWidth - width) / 2),
      initialY: Math.max(20, (window.innerHeight - height) / 2)
    };
  }

  createBackdrop(zIndex) {
    const backdrop = document.createElement('div');
    backdrop.className = 'retro-dialog-backdrop';
    backdrop.style.zIndex = zIndex - 1;
    document.body.appendChild(backdrop);
    this.activeBackdrop = backdrop;
    return backdrop;
  }

  removeBackdrop() {
    if (this.activeBackdrop) {
      this.activeBackdrop.remove();
      this.activeBackdrop = null;
    }
  }

  destroyDialog(dialog) {
    dialog.destroy();
    this.removeBackdrop();
    this.activeDialog = null;
    this.activeResolve = null;
  }

  /**
   * Show alert dialog
   */
  alert(message, title = 'Information', icon = 'info') {
    this.close();

    return new Promise((resolve) => {
      const width = 400;
      const height = 180;
      const content = this.createDialogContent(message, icon);

      const dialog = new RetroWindow({
        title,
        width,
        height,
        ...this.getCenteredPosition(width, height),
        resizable: false,
        zIndex: 10000
      });

      content.style.padding = '10px';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.height = '100%';

      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.justifyContent = 'center';
      buttonContainer.style.marginTop = 'auto';
      buttonContainer.style.paddingTop = '10px';

      const okButton = new RetroButton({
        text: 'OK',
        variant: 'primary',
        onClick: () => {
          this.destroyDialog(dialog);
          resolve(true);
        }
      });

      buttonContainer.appendChild(okButton.element);
      content.appendChild(buttonContainer);

      dialog.setContent(content);
      this.createBackdrop(dialog.options.zIndex);
      dialog.mount(document.body);

      this.activeDialog = dialog;
      this.activeResolve = resolve;

      // Focus OK button
      setTimeout(() => okButton.element.focus(), 100);
    });
  }

  /**
   * Show confirm dialog
   */
  confirm(message, title = 'Confirm', icon = 'question') {
    // See alert()'s comment on this guard.
    this.close();

    return new Promise((resolve) => {
      const width = 400;
      const height = 180;
      const content = this.createDialogContent(message, icon);

      const dialog = new RetroWindow({
        title,
        width,
        height,
        ...this.getCenteredPosition(width, height),
        resizable: false,
        zIndex: 10000
      });

      content.style.padding = '10px';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.height = '100%';

      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.justifyContent = 'center';
      buttonContainer.style.gap = '10px';
      buttonContainer.style.marginTop = 'auto';
      buttonContainer.style.paddingTop = '10px';

      const yesButton = new RetroButton({
        text: 'Yes',
        variant: 'primary',
        onClick: () => {
          this.destroyDialog(dialog);
          resolve(true);
        }
      });

      const noButton = new RetroButton({
        text: 'No',
        onClick: () => {
          this.destroyDialog(dialog);
          resolve(false);
        }
      });

      buttonContainer.appendChild(yesButton.element);
      buttonContainer.appendChild(noButton.element);
      content.appendChild(buttonContainer);

      dialog.setContent(content);
      this.createBackdrop(dialog.options.zIndex);
      dialog.mount(document.body);

      this.activeDialog = dialog;
      this.activeResolve = resolve;

      // Focus Yes button
      setTimeout(() => yesButton.element.focus(), 100);
    });
  }

  /**
   * Show prompt dialog
   */
  prompt(message, title = 'Input', defaultValue = '', icon = 'edit') {
    // See alert()'s comment on this guard.
    this.close();

    return new Promise((resolve) => {
      const width = 450;
      const height = 200;
      const content = this.createDialogContent(message, icon);

      const dialog = new RetroWindow({
        title,
        width,
        height,
        ...this.getCenteredPosition(width, height),
        resizable: false,
        zIndex: 10000
      });

      content.style.padding = '10px';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.height = '100%';

      const inputContainer = document.createElement('div');
      inputContainer.style.marginTop = '15px';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue;
      input.className = 'retro-input';
      input.style.width = '100%';
      input.style.padding = '4px';

      inputContainer.appendChild(input);
      content.appendChild(inputContainer);

      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.justifyContent = 'center';
      buttonContainer.style.gap = '10px';
      buttonContainer.style.marginTop = 'auto';
      buttonContainer.style.paddingTop = '10px';

      const handleSubmit = () => {
        const value = input.value;
        this.destroyDialog(dialog);
        resolve(value);
      };

      const okButton = new RetroButton({
        text: 'OK',
        variant: 'primary',
        onClick: handleSubmit
      });

      const cancelButton = new RetroButton({
        text: 'Cancel',
        onClick: () => {
          this.destroyDialog(dialog);
          resolve(null);
        }
      });

      buttonContainer.appendChild(okButton.element);
      buttonContainer.appendChild(cancelButton.element);
      content.appendChild(buttonContainer);

      dialog.setContent(content);
      this.createBackdrop(dialog.options.zIndex);
      dialog.mount(document.body);

      this.activeDialog = dialog;
      this.activeResolve = resolve;

      // Focus input and select text
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);

      // Handle Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          handleSubmit();
        } else if (e.key === 'Escape') {
          this.destroyDialog(dialog);
          resolve(null);
        }
      });
    });
  }

  /**
   * Show error dialog
   */
  error(message, title = 'Error') {
    return this.alert(message, title, 'error');
  }

  /**
   * Show warning dialog
   */
  warning(message, title = 'Warning') {
    return this.alert(message, title, 'warning');
  }

  /**
   * Create dialog content with icon and message
   */
  createDialogContent(message, icon) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '15px';
    container.style.alignItems = 'flex-start';

    const iconElement = document.createElement('div');
    iconElement.innerHTML = DIALOG_ICONS[icon] || DIALOG_ICONS.info;
    iconElement.style.width = '32px';
    iconElement.style.height = '32px';
    iconElement.style.flexShrink = '0';

    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.fontFamily = 'var(--font-primary)';
    messageElement.style.fontSize = 'var(--font-size-normal)';
    messageElement.style.lineHeight = '1.5';
    messageElement.style.flex = '1';
    messageElement.style.wordWrap = 'break-word';
    messageElement.style.whiteSpace = 'pre-line';

    container.appendChild(iconElement);
    container.appendChild(messageElement);

    return container;
  }

  close() {
    if (this.activeDialog) {
      const resolve = this.activeResolve;
      this.destroyDialog(this.activeDialog);
      resolve?.(null);
    }
  }
}

// Create singleton instance
const retroDialog = new RetroDialog();

export default retroDialog;
