/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundService {
  private audioContext: AudioContext | null = null;

  private init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume: number = 0.1) {
    this.init();
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);

    gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start();
    osc.stop(this.audioContext.currentTime + duration);
  }

  playMove() {
    this.playTone(150, 0.05, 'square', 0.02);
  }

  playEat() {
    this.playTone(400, 0.1, 'square', 0.1);
    setTimeout(() => this.playTone(600, 0.1, 'square', 0.1), 50);
  }

  playGameOver() {
    this.playTone(300, 0.2, 'sawtooth', 0.1);
    setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.1), 150);
    setTimeout(() => this.playTone(100, 0.4, 'sawtooth', 0.1), 300);
  }

  playStart() {
    this.playTone(523.25, 0.1, 'square', 0.1); // C5
    setTimeout(() => this.playTone(659.25, 0.1, 'square', 0.1), 100); // E5
    setTimeout(() => this.playTone(783.99, 0.2, 'square', 0.1), 200); // G5
  }
}

export const soundService = new SoundService();
