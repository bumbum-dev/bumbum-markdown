/**
 * RetroSounds
 * Manages Windows 95-style sound effects
 */

import * as Storage from '../../modules/Storage.js';

class RetroSounds {
  constructor() {
    this.audioCache = new Map();
    this.config = this.loadConfig();
    this.initializeSounds();
  }

  /**
   * Load configuration from localStorage
   */
  loadConfig() {
    return Storage.getItem('retro-sounds-config') || {
      enabled: false, // Disabled by default
      volume: 0.3
    };
  }

  /**
   * Save configuration to localStorage
   */
  saveConfig() {
    Storage.setItem('retro-sounds-config', this.config);
  }

  /**
   * Initialize sound files
   */
  initializeSounds() {
    // Generate simple beep sounds using Web Audio API
    const sounds = {
      click: () => this.generateTone(800, 0.05),
      windowOpen: () => this.generateTone(600, 0.1, 'ascending'),
      windowClose: () => this.generateTone(600, 0.1, 'descending'),
      minimize: () => this.generateTone(400, 0.08),
      error: () => this.generateTone(200, 0.15),
      button: () => this.generateTone(1000, 0.03),
    };

    Object.entries(sounds).forEach(([key, generator]) => {
      this.audioCache.set(key, generator);
    });
  }

  /**
   * Generate a simple tone using Web Audio API
   */
  generateTone(frequency, duration, type = 'simple') {
    if (!this.config.enabled) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

      // Apply volume
      gainNode.gain.setValueAtTime(this.config.volume, audioContext.currentTime);

      // Different envelope types
      if (type === 'ascending') {
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 1.5,
          audioContext.currentTime + duration
        );
      } else if (type === 'descending') {
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 0.7,
          audioContext.currentTime + duration
        );
      }

      // Fade out
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + duration
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.debug('Sound playback failed:', error);
    }
  }

  /**
   * Play a sound by type
   */
  playSound(type) {
    if (!this.config.enabled) return;

    const soundGenerator = this.audioCache.get(type);
    if (soundGenerator) {
      soundGenerator();
    }
  }

  /**
   * Toggle sound effects on/off
   */
  toggleSounds() {
    this.config.enabled = !this.config.enabled;
    this.saveConfig();
    return this.config.enabled;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume) {
    this.config.volume = Math.max(0, Math.min(1, volume));
    this.saveConfig();
  }

  /**
   * Enable sounds
   */
  enable() {
    this.config.enabled = true;
    this.saveConfig();
  }

  /**
   * Disable sounds
   */
  disable() {
    this.config.enabled = false;
    this.saveConfig();
  }

  /**
   * Check if sounds are enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Get current volume
   */
  getVolume() {
    return this.config.volume;
  }
}

// Create singleton instance
const retroSounds = new RetroSounds();

export default retroSounds;
