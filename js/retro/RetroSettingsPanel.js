/**
 * RetroSettingsPanel
 * Allows users to toggle retro effects (scanlines, CRT, sounds)
 */

import { RetroWindow } from './RetroWindow.js';
import { RetroButton } from './RetroButton.js';
import retroSounds from './sounds/RetroSounds.js';
import * as Storage from '../modules/Storage.js';

class RetroSettingsPanel {
  constructor() {
    this.window = null;
    this.settings = this.loadSettings();
    this.applySettings();
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    return Storage.getItem('retro-settings') || {
      scanlinesEnabled: false,
      crtEffectEnabled: false,
      soundsEnabled: false
    };
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    Storage.setItem('retro-settings', this.settings);
  }

  /**
   * Apply settings to the body element
   */
  applySettings() {
    // Apply scanlines
    if (this.settings.scanlinesEnabled) {
      document.body.classList.add('retro-scanlines');
    } else {
      document.body.classList.remove('retro-scanlines');
    }

    // Apply CRT effect
    if (this.settings.crtEffectEnabled) {
      document.body.classList.add('retro-crt-effect');
    } else {
      document.body.classList.remove('retro-crt-effect');
    }

    // Sync sounds setting (managed by RetroSounds)
    if (this.settings.soundsEnabled !== retroSounds.isEnabled()) {
      retroSounds.toggleSounds();
    }
  }

  /**
   * Toggle scanlines effect
   */
  toggleScanlines() {
    this.settings.scanlinesEnabled = !this.settings.scanlinesEnabled;
    this.saveSettings();
    this.applySettings();
  }

  /**
   * Toggle CRT effect
   */
  toggleCrtEffect() {
    this.settings.crtEffectEnabled = !this.settings.crtEffectEnabled;
    this.saveSettings();
    this.applySettings();
  }

  /**
   * Toggle sounds
   */
  toggleSounds() {
    this.settings.soundsEnabled = !this.settings.soundsEnabled;
    retroSounds.toggleSounds();
    this.saveSettings();
  }

  /**
   * Reset to defaults
   */
  resetSettings() {
    this.settings = {
      scanlinesEnabled: false,
      crtEffectEnabled: false,
      soundsEnabled: false
    };
    this.saveSettings();
    this.applySettings();
    
    // Re-render if window is open
    if (this.window) {
      this.close();
      this.open();
    }
  }

  /**
   * Create the settings panel content
   */
  createContent() {
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.fontFamily = 'var(--font-primary)';
    container.style.fontSize = 'var(--font-size-normal)';
    container.style.overflowY = 'auto';
    container.style.height = '100%';

    // Visual Effects Section
    const visualFieldset = document.createElement('fieldset');
    visualFieldset.className = 'retro-fieldset';
    
    const visualLegend = document.createElement('legend');
    visualLegend.textContent = 'Visual Effects';
    visualFieldset.appendChild(visualLegend);

    // Scanlines checkbox
    const scanlinesDiv = this.createCheckboxControl(
      'Enable Scanlines Effect',
      'Adds subtle horizontal scanlines for authentic CRT monitor look',
      this.settings.scanlinesEnabled,
      () => {
        this.toggleScanlines();
        retroSounds.playSound('click');
      }
    );
    visualFieldset.appendChild(scanlinesDiv);

    // CRT effect checkbox
    const crtDiv = this.createCheckboxControl(
      'Enable CRT Monitor Effect',
      'Adds screen curvature and subtle flicker effect',
      this.settings.crtEffectEnabled,
      () => {
        this.toggleCrtEffect();
        retroSounds.playSound('click');
      }
    );
    visualFieldset.appendChild(crtDiv);

    container.appendChild(visualFieldset);

    // Audio Effects Section
    const audioFieldset = document.createElement('fieldset');
    audioFieldset.className = 'retro-fieldset';
    audioFieldset.style.marginTop = '15px';
    
    const audioLegend = document.createElement('legend');
    audioLegend.textContent = 'Audio Effects';
    audioFieldset.appendChild(audioLegend);

    // Sounds checkbox
    const soundsDiv = this.createCheckboxControl(
      'Enable Sound Effects',
      'Play Windows 95-style sounds on button clicks and window actions',
      this.settings.soundsEnabled,
      () => {
        this.toggleSounds();
        // Play sound after toggle to demonstrate
        setTimeout(() => retroSounds.playSound('click'), 100);
      }
    );
    audioFieldset.appendChild(soundsDiv);

    // Volume slider (only show if sounds enabled)
    if (this.settings.soundsEnabled) {
      const volumeDiv = this.createVolumeControl();
      audioFieldset.appendChild(volumeDiv);
    }

    container.appendChild(audioFieldset);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.justifyContent = 'flex-end';
    actionsDiv.style.gap = '10px';
    actionsDiv.style.paddingTop = '20px';
    actionsDiv.style.marginTop = '20px';
    actionsDiv.style.borderTop = '1px solid var(--win95-gray-dark)';

    const resetButton = new RetroButton({
      text: 'Reset to Defaults',
      onClick: () => {
        retroSounds.playSound('click');
        this.resetSettings();
      }
    });

    const okButton = new RetroButton({
      text: 'OK',
      variant: 'primary',
      onClick: () => {
        retroSounds.playSound('click');
        this.close();
      }
    });

    actionsDiv.appendChild(resetButton.element);
    actionsDiv.appendChild(okButton.element);
    container.appendChild(actionsDiv);

    // Note section
    const noteDiv = document.createElement('div');
    noteDiv.style.marginTop = '15px';
    noteDiv.style.padding = '10px';
    noteDiv.style.background = 'var(--win95-gray-light)';
    noteDiv.style.border = '1px solid var(--win95-gray-dark)';
    noteDiv.style.fontSize = '10px';
    noteDiv.style.lineHeight = '1.5';
    noteDiv.innerHTML = `
      <strong>Note:</strong> These effects are optional and disabled by default.
      They enhance the retro aesthetic but may impact performance on some devices.
    `;
    container.appendChild(noteDiv);

    return container;
  }

  /**
   * Create a checkbox control with label and description
   */
  createCheckboxControl(label, description, checked, onChange) {
    const div = document.createElement('div');
    div.style.marginBottom = '20px';
    div.style.padding = '10px 0';

    const labelElement = document.createElement('label');
    labelElement.className = 'retro-label';
    labelElement.style.display = 'flex';
    labelElement.style.alignItems = 'center';
    labelElement.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'retro-checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', onChange);

    const span = document.createElement('span');
    span.textContent = label;

    labelElement.appendChild(checkbox);
    labelElement.appendChild(span);

    const descElement = document.createElement('p');
    descElement.style.margin = '5px 0 0 24px';
    descElement.style.color = 'var(--win95-gray-darker)';
    descElement.style.fontSize = '10px';
    descElement.style.lineHeight = '1.4';
    descElement.textContent = description;

    div.appendChild(labelElement);
    div.appendChild(descElement);

    return div;
  }

  /**
   * Create volume control slider
   */
  createVolumeControl() {
    const div = document.createElement('div');
    div.style.marginTop = '15px';
    div.style.padding = '10px 0';

    const label = document.createElement('label');
    label.className = 'retro-label';
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    
    const volumePercent = Math.round(retroSounds.getVolume() * 100);
    label.innerHTML = `<span>Volume: <strong>${volumePercent}%</strong></span>`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'retro-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = volumePercent;
    slider.style.width = '100%';
    
    slider.addEventListener('input', (e) => {
      const volume = Number(e.target.value) / 100;
      retroSounds.setVolume(volume);
      label.innerHTML = `<span>Volume: <strong>${e.target.value}%</strong></span>`;
    });

    slider.addEventListener('change', () => {
      retroSounds.playSound('click');
    });

    div.appendChild(label);
    div.appendChild(slider);

    return div;
  }

  /**
   * Find the highest z-index among currently open windows, so this panel
   * can always open on top of them (it isn't tracked by RetroLayout's
   * window manager, which assigns its own z-indexes starting above 100).
   */
  getTopZIndex() {
    let maxZ = 100;
    document.querySelectorAll('.win95-window').forEach((el) => {
      const z = parseInt(el.style.zIndex, 10) || 0;
      if (z > maxZ) maxZ = z;
    });
    return maxZ;
  }

  /**
   * Open the settings panel
   */
  open() {
    if (this.window) {
      // Already open, just focus
      this.window.focus();
      return;
    }

    this.window = new RetroWindow({
      title: 'Retro Effects Settings',
      icon: '🖥️',
      width: 500,
      height: 450,
      initialX: 200,
      initialY: 150,
      resizable: false,
      zIndex: this.getTopZIndex() + 1,
      onClose: () => {
        retroSounds.playSound('windowClose');
        this.window.destroy();
        this.window = null;
      }
    });

    const content = this.createContent();
    this.window.setContent(content);
    this.window.mount(document.body);

    retroSounds.playSound('windowOpen');
  }

  /**
   * Close the settings panel
   */
  close() {
    if (this.window) {
      this.window.destroy();
      this.window = null;
    }
  }

  /**
   * Check if panel is open
   */
  isOpen() {
    return this.window !== null;
  }
}

// Create singleton instance
const retroSettingsPanel = new RetroSettingsPanel();

export default retroSettingsPanel;
