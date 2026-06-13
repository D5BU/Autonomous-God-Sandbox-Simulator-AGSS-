export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicPlaying = false;
    this.ambientOscs = [];
    this.ambientGain = null;
    this.musicTimeout = null;

    // Simple procedural sound effects queue rate limiters
    this.lastSfxTime = {};
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      // Ambient gain
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.0; // Starts muted, fades in
      this.ambientGain.connect(this.masterGain);

      // Start infinite ambient soundtrack loop
      this.startAmbientMusic();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked:", e);
    }
  }

  toggle(forceState) {
    if (forceState !== undefined) {
      this.enabled = forceState;
    } else {
      this.enabled = !this.enabled;
    }

    if (this.ctx) {
      if (this.enabled) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        this.fadeGain(this.ambientGain, 0.15, 1.5); // Fade ambient back in
      } else {
        this.fadeGain(this.ambientGain, 0.0, 1.0);  // Mute ambient
      }
    }
    return this.enabled;
  }

  fadeGain(gainNode, targetValue, duration) {
    if (!gainNode || !this.ctx) return;
    gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(targetValue, this.ctx.currentTime + duration);
  }

  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  playSfx(type) {
    if (!this.enabled) return;
    this.init(); // Auto init on user interaction
    if (!this.ctx) return;

    // Rate limit same sound effects
    const now = this.ctx.currentTime;
    if (this.lastSfxTime[type] && now - this.lastSfxTime[type] < 0.1) {
      return;
    }
    this.lastSfxTime[type] = now;

    switch (type) {
      case 'place':
        this.synthesizePlaceSound();
        break;
      case 'steam':
        this.synthesizeSteamSound();
        break;
      case 'eruption':
        this.synthesizeEruptionSound();
        break;
      case 'fire_crackle':
        this.synthesizeFireCrackle();
        break;
    }
  }

  synthesizePlaceSound() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  synthesizeSteamSound() {
    // Sizzling noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4500, this.ctx.currentTime);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.35);
  }

  synthesizeFireCrackle() {
    // Sharp clicky pops for fire crackle
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100 + Math.random() * 500, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime + 0.015);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.02);
  }

  synthesizeEruptionSound() {
    // Deep low rumble explosion
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 1.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.0);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // Deep sub sweep oscillator
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, this.ctx.currentTime);
    subOsc.frequency.linearRampToValueAtTime(20, this.ctx.currentTime + 1.2);
    
    subGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    noise.start();
    noise.stop(this.ctx.currentTime + 2.0);

    subOsc.start();
    subOsc.stop(this.ctx.currentTime + 1.5);
  }

  // Infinite procedural peaceful ambient soundtrack
  startAmbientMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    
    if (this.enabled) {
      this.fadeGain(this.ambientGain, 0.15, 2.0);
    }

    // Modal scales for beautiful celestial space music
    // We will alternate between C Major (C - E - G - B), A Minor (A - C - E - G), F Major (F - A - C - E), and G Major (G - B - D - F)
    const chords = [
      [130.81, 164.81, 196.00, 246.94], // Cmaj7 (C3, E3, G3, B3)
      [110.00, 130.81, 164.81, 196.00], // Amin7 (A2, C3, E3, G3)
      [87.31, 110.00, 130.81, 164.81],  // Fmaj7 (F2, A2, C3, E3)
      [98.00, 123.47, 146.83, 174.61]   // Gdom7 (G2, B2, D3, F3)
    ];

    let chordIndex = 0;

    const playNextChord = () => {
      if (!this.enabled || !this.musicPlaying) {
        this.musicTimeout = setTimeout(playNextChord, 8000);
        return;
      }

      const activeChord = chords[chordIndex];
      chordIndex = (chordIndex + 1) % chords.length;

      const oscs = [];
      const now = this.ctx.currentTime;

      // Play each note of the chord with a slow attack / release and gentle detune
      activeChord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        
        // Soft detuning for rich chorusing
        osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);

        // Slow Attack / Fade out
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04 + (Math.random() * 0.02), now + 2.0 + Math.random() * 1.0);
        gain.gain.setValueAtTime(gain.gain.value, now + 5.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 8.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);

        osc.start(now);
        osc.stop(now + 9.0);

        oscs.push(osc);
      });

      this.musicTimeout = setTimeout(playNextChord, 8000);
    };

    playNextChord();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimeout) clearTimeout(this.musicTimeout);
  }
}

