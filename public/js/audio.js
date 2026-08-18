/**
 * KARTLAN 3D - Procedural Web Audio API Synthesizer
 * 100% standalone, zero external audio asset dependencies.
 * Generates engine rumble, drift screeches, mini-turbo chimes, boost whooshes,
 * countdown beeps, item effects, and upbeat retro-arcade chiptune music!
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.isMuted = false;

    // Engine synth state
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineNoise = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.engineRunning = false;

    // Drift screech state
    this.driftNoise = null;
    this.driftFilter = null;
    this.driftGain = null;

    // Music sequencer state
    this.musicPlaying = false;
    this.musicTimer = null;
    this.bpm = 138;
    this.musicStep = 0;
    this.isFinalLap = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.initEngineSynth();
    this.initDriftSynth();
  }

  resume() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  initEngineSynth() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, now);
    this.engineGain.connect(this.sfxGain);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(300, now);
    this.engineFilter.Q.setValueAtTime(4, now);
    this.engineFilter.connect(this.engineGain);

    // Osc 1: Sawtooth for low rumble
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(55, now);
    this.engineOsc1.connect(this.engineFilter);

    // Osc 2: Triangle an octave higher for body
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(110, now);
    this.engineOsc2.connect(this.engineFilter);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineRunning = true;
  }

  initDriftSynth() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // White noise buffer for tire screech
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(1800, now);
    this.driftFilter.Q.setValueAtTime(5, now);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0, now);

    whiteNoise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.sfxGain);

    whiteNoise.start();
  }

  updateEngine(speedNormalized, throttle, isBoosting) {
    if (!this.ctx || !this.engineRunning) return;
    const now = this.ctx.currentTime;

    const baseFreq = 48 + speedNormalized * 120 + (throttle ? 25 : 0) + (isBoosting ? 60 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.05);

    const cutoff = 250 + speedNormalized * 1600 + (isBoosting ? 800 : 0);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);

    const volume = 0.15 + speedNormalized * 0.25 + (throttle ? 0.1 : 0);
    this.engineGain.gain.setTargetAtTime(volume, now, 0.05);
  }

  setDriftScreech(isDrifting, intensity = 1.0) {
    if (!this.ctx || !this.driftGain) return;
    const now = this.ctx.currentTime;
    const targetGain = isDrifting ? 0.22 * intensity : 0.0;
    this.driftGain.gain.setTargetAtTime(targetGain, now, 0.04);
    if (isDrifting) {
      this.driftFilter.frequency.setTargetAtTime(1400 + intensity * 800, now, 0.05);
    }
  }

  playHop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  playMiniTurboCharge(tier) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [
      [523.25, 659.25], // Blue: C5, E5
      [659.25, 783.99], // Orange: E5, G5
      [783.99, 1046.50] // Purple: G5, C6
    ];
    const pair = freqs[Math.min(tier - 1, 2)] || freqs[0];

    pair.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.18);

      gain.gain.setValueAtTime(0.25, now + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + idx * 0.03);
      osc.stop(now + 0.22);
    });
  }

  playTurboBoost() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Sub bass punch
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.46);

    // Whoosh filter sweep
    const bufferSize = this.ctx.sampleRate * 0.6;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(4500, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.55);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.56);
  }

  playCountdownBeep(isFinal) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isFinal ? 'triangle' : 'sine';
    const freq = isFinal ? 880 : 440; // High A5 vs A4
    osc.frequency.setValueAtTime(freq, now);

    const duration = isFinal ? 0.6 : 0.25;
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playItemBoxRoll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.12, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.09);
    });
  }

  playItemGet() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major
    chord.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.42);
    });
  }

  playShellFire() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.18);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  playExplosion() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.41);

    const bufferSize = this.ctx.sampleRate * 0.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.5);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.51);
  }

  playBananaSlip() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(300, now + 0.15);
    osc.frequency.linearRampToValueAtTime(900, now + 0.3);
    osc.frequency.linearRampToValueAtTime(200, now + 0.5);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.51);
  }

  playZap() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200 - i * 200, now + i * 0.05);
      osc.frequency.exponentialRampToValueAtTime(200, now + i * 0.05 + 0.1);

      gain.gain.setValueAtTime(0.2, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.1);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.11);
    }
  }

  playVictoryFanfare() {
    if (!this.ctx) return;
    this.stopMusic();
    const now = this.ctx.currentTime;
    const melody = [
      { f: 523.25, d: 0.15, t: 0 },
      { f: 523.25, d: 0.15, t: 0.15 },
      { f: 523.25, d: 0.15, t: 0.3 },
      { f: 523.25, d: 0.45, t: 0.45 },
      { f: 415.30, d: 0.45, t: 0.9 },
      { f: 466.16, d: 0.45, t: 1.35 },
      { f: 523.25, d: 0.6, t: 1.8 },
      { f: 659.25, d: 0.9, t: 2.4 }
    ];

    melody.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now + note.t);

      gain.gain.setValueAtTime(0.3, now + note.t);
      gain.gain.exponentialRampToValueAtTime(0.01, now + note.t + note.d);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + note.t);
      osc.stop(now + note.t + note.d + 0.02);
    });
  }

  startMusic(isFinalLap = false) {
    if (!this.ctx) this.init();
    this.stopMusic();
    this.musicPlaying = true;
    this.isFinalLap = isFinalLap;
    this.bpm = isFinalLap ? 160 : 136;
    this.musicStep = 0;

    const stepDuration = (60 / this.bpm) / 4; // 16th notes
    let nextNoteTime = this.ctx.currentTime + 0.05;

    const scheduler = () => {
      if (!this.musicPlaying) return;
      while (nextNoteTime < this.ctx.currentTime + 0.2) {
        this.playMusicStep(this.musicStep, nextNoteTime);
        nextNoteTime += stepDuration;
        this.musicStep = (this.musicStep + 1) % 64;
      }
      this.musicTimer = setTimeout(scheduler, 40);
    };

    scheduler();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  playMusicStep(step, time) {
    if (!this.ctx || !this.musicPlaying) return;

    // Bassline (Driving 16th synth bass)
    const bassScale = [130.81, 130.81, 146.83, 164.81, 174.61, 164.81, 146.83, 130.81]; // C3, D3, E3, F3...
    const bassIdx = Math.floor(step / 4) % bassScale.length;
    if (step % 2 === 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassScale[bassIdx] * (step % 4 === 2 ? 1.0 : 0.5), time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, time);
      filter.frequency.exponentialRampToValueAtTime(120, time + 0.1);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + 0.13);
    }

    // Drums: Kick on 0, 4, 8, 12, Snare on 4, 12, Hi-Hat on every 2
    const beat = step % 16;
    if (beat === 0 || beat === 8 || beat === 14) {
      // Kick
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.frequency.setValueAtTime(150, time);
      kickOsc.frequency.exponentialRampToValueAtTime(35, time + 0.08);
      kickGain.gain.setValueAtTime(0.35, time);
      kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.09);
      kickOsc.connect(kickGain);
      kickGain.connect(this.musicGain);
      kickOsc.start(time);
      kickOsc.stop(time + 0.1);
    }

    if (beat === 4 || beat === 12) {
      // Snare
      const snareGain = this.ctx.createGain();
      snareGain.gain.setValueAtTime(0.2, time);
      snareGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.12, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(snareGain);
      snareGain.connect(this.musicGain);
      src.start(time);
    }

    // Lead Melody (Catchy 8-bar arcade racing hook)
    const melodyNotes = [
      523.25, 0, 659.25, 0, 783.99, 880, 0, 783.99,
      659.25, 0, 523.25, 0, 587.33, 0, 659.25, 0,
      783.99, 0, 880, 0, 1046.5, 0, 880, 0,
      783.99, 659.25, 587.33, 659.25, 523.25, 0, 0, 0
    ];
    const melNote = melodyNotes[step % melodyNotes.length];
    if (melNote > 0) {
      const melOsc = this.ctx.createOscillator();
      const melGain = this.ctx.createGain();
      melOsc.type = 'triangle';
      melOsc.frequency.setValueAtTime(melNote, time);

      melGain.gain.setValueAtTime(0.18, time);
      melGain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

      melOsc.connect(melGain);
      melGain.connect(this.musicGain);

      melOsc.start(time);
      melOsc.stop(time + 0.2);
    }
  }
}

export const sound = new SoundEngine();
