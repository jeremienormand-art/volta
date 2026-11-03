// ─────────────────────────────────────────────────────────────
// AUDIO — sons synthétisés (aucun fichier, aucun son protégé). Débloqué au premier toucher.
// Chaque son est une fonction nommée : on la remplacera par un échantillon sans changer les appels.
// ─────────────────────────────────────────────────────────────
const Sfx = {
  ctx: null, master: null, on: true, pullNode: null, noiseBuf: null,
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  },
  ok() { return this.on && this.ctx && this.ctx.state === 'running'; },
  tone(f, dur, type = 'sine', vol = 0.3, slide = null, delay = 0) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, freq = 1200, q = 1, vol = 0.2, type = 'bandpass', delay = 0, freqTo = null) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  pullStart() {
    if (!this.ok() || this.pullNode) return;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 2.5;
    f.frequency.linearRampToValueAtTime(1500, c.currentTime + 0.7);
    const g = c.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.05);
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    this.pullNode = { s, g };
  },
  pullStop() {
    if (!this.pullNode) return;
    const { s, g } = this.pullNode; this.pullNode = null;
    try { const t = this.ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); s.stop(t + 0.08); } catch (e) { /* */ }
  },
  pick() { this.tone(620, 0.05, 'triangle', 0.18); this.noise(0.04, 3000, 2, 0.06); },
  clink(level = 0) { const b = 1900 + level * 180; this.tone(b, 0.14, 'sine', 0.2); this.tone(b * 1.5, 0.1, 'sine', 0.1, null, 0.01); },
  coin(mult) { const base = mult >= 3 ? 880 : mult >= 2 ? 784 : mult >= 1.5 ? 698 : 587; this.tone(base, 0.07, 'square', 0.06); this.tone(base * 1.5, 0.09, 'square', 0.05, null, 0.06); },
  zone() { this.tone(1568, 0.07, 'sine', 0.13); this.tone(2093, 0.06, 'sine', 0.06, null, 0.03); },
  perfect() { this.tone(1319, 0.12, 'sine', 0.14, null, 0.08); this.tone(1760, 0.18, 'sine', 0.12, null, 0.14); },
  wrong() { this.tone(180, 0.16, 'sawtooth', 0.12); this.tone(142, 0.2, 'sawtooth', 0.1, null, 0.08); },
  left() { this.tone(420, 0.32, 'triangle', 0.14, 190); },
  overflow() { this.noise(0.35, 800, 1, 0.18, 'lowpass', 0, 300); this.tone(300, 0.2, 'sine', 0.08, 120); },
  discard() { this.noise(0.08, 1800, 3, 0.05); },
  launch() { this.noise(0.22, 600, 2, 0.1, 'bandpass', 0, 1100); },
  ready() { this.tone(1320, 0.1, 'sine', 0.1); this.tone(1980, 0.12, 'sine', 0.06, null, 0.05); },
  busy() { this.tone(220, 0.06, 'square', 0.05); },
  comboUp(mult) { const n = [523, 659, 784, mult >= 3 ? 1175 : 1047]; n.forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, null, i * 0.06)); },
  alexHey() { this.tone(500, 0.35, 'sine', 0.14, 1400); },
  gulp() { this.tone(160, 0.12, 'sine', 0.22, 90, 0.7); this.tone(150, 0.12, 'sine', 0.2, 80, 0.9); this.tone(900, 0.06, 'sine', 0.12, 1500, 1.25); },
  stamp() { this.noise(0.07, 260, 1.2, 0.3, 'lowpass'); this.tone(120, 0.09, 'sine', 0.25, 70); },   // v1.26 : tampon de Jérémie
  laugh() { [0, 0.11, 0.22].forEach((d, i) => this.tone(560 - i * 30, 0.08, 'triangle', 0.13, 760 - i * 30, d)); },   // Volta : Michel rit de sa blague
  hiccup() { this.tone(900, 0.06, 'sine', 0.08, 1500); },
  swap() { this.noise(0.25, 900, 1, 0.08, 'bandpass', 0, 2400); },
  hugoAlarm() { [0, 0.18, 0.36].forEach((d) => { this.tone(880, 0.12, 'square', 0.07, null, d); this.tone(660, 0.12, 'square', 0.07, null, d + 0.09); }); },
  tick(loud) { this.tone(loud ? 2000 : 1500, 0.03, 'square', loud ? 0.08 : 0.035); },
  win() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, 'square', 0.06, null, i * 0.08)); },
  fail() { this.tone(330, 0.3, 'triangle', 0.12, 220); },
  bell() { this.tone(880, 1.2, 'sine', 0.16); this.tone(1760, 0.8, 'sine', 0.05); this.tone(2640, 0.5, 'sine', 0.03); },
  beep(hi) { this.tone(hi ? 1320 : 880, 0.09, 'square', 0.06); },
  record() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'square', 0.06, null, i * 0.09)); },
  noGlass() { this.tone(330, 0.07, 'triangle', 0.08); },
  // v1.11 : néon qui grésille en s'allumant, rideau métallique, imprimante à tickets
  neon(delay = 0, weak = false) {
    [0, 0.12, 0.24, 0.36].forEach((d, i) => this.noise(0.04, 3200, 5, i === 3 ? 0.06 : 0.04, 'bandpass', delay + d));
    this.tone(110, weak ? 0.7 : 0.4, 'sawtooth', 0.02, null, delay + 0.36);
  },
  shutter() {
    for (let i = 0; i < 8; i++) this.noise(0.06, 1500 - i * 90, 2.5, 0.06, 'bandpass', i * 0.07);
    this.noise(0.25, 260, 1, 0.2, 'lowpass', 0.56); this.tone(70, 0.3, 'sine', 0.25, 45, 0.56);
  },
  shutterUp() { for (let i = 0; i < 8; i++) this.noise(0.05, 700 + i * 110, 2.5, 0.045, 'bandpass', i * 0.07); },
  print() { for (let i = 0; i < 12; i++) this.noise(0.025, 4200, 6, 0.04, 'bandpass', 0.05 + i * 0.075); },
};

const Haptics = {
  on: true, dead: false,
  buzz(ms) {
    if (!this.on || this.dead || !navigator.vibrate) return;
    try { if (navigator.vibrate(ms) === false) this.dead = true; } catch (e) { this.dead = true; }
  },
};
