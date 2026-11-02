// Rythme d'une partie : arrivées, doubles, clients en attente et temps de bar vide par tranche de 20 s (un palier), joué par le bot.
// Usage : node test/rythme.mjs [parties] [profil] [dossier src] ['{"réglage":valeur}']  (dossier src : pour comparer avec une ancienne version ; '' = actuel)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const N = +(process.argv[2] || 200);
const prof = process.argv[3] || 'debutant';
const over = JSON.parse(process.argv[5] || '{}');
const dir = process.argv[4] ? path.resolve(process.argv[4]) + '/' : new URL('../src/', import.meta.url).pathname;
const code = ['config.js', 'core.js', 'bot.js'].map((f) => fs.readFileSync(dir + f, 'utf8')).join('\n');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.API={DEFAULTS,Game,BOT_PROFILES,botDecide,mulberry32,gauss};', ctx);
const { DEFAULTS, Game, BOT_PROFILES, botDecide, mulberry32, gauss } = ctx.API;

const W = 20, B = 6;   // tranches de 20 s : une par palier de difficulté
const arr = new Array(B).fill(0), occ = new Array(B).fill(0), samples = new Array(B).fill(0), left = new Array(B).fill(0), empty = new Array(B).fill(0), dbl = new Array(B).fill(0);
for (let i = 0; i < N; i++) {
  const cfg = Object.assign({}, DEFAULTS, { prep: 'tirage', alexOn: false, hugoOn: false }, over);
  const g = new Game(cfg, (4242 + i * 7919) >>> 0);
  const r = mulberry32((i * 31 + 7) >>> 0);
  // « novice » : un nouveau venu, plus lent que le débutant du simulateur (lecture, pouce, précision)
  const p = prof === 'novice' ? { think: 1.4, tap: 0.6, err: 0.08, pullSd: 0.12, smart: 0.3, alexAccept: 0.5 } : BOT_PROFILES[prof];
  let ready = 0, holdUntil = -1, n = 0;
  while (!g.over) {
    g.step(1 / 60);
    for (const e of g.events) {
      const b = Math.min(B - 1, Math.floor(g.t / W));
      if (e.type === 'spawn') { arr[b]++; const s = g.seats[e.seat]; if (s && s.dbl) dbl[b]++; }
      if (e.type === 'left') left[b]++;
    }
    g.events.length = 0;
    if (++n % 30 === 0) { const b = Math.min(B - 1, Math.floor(g.t / W)); const w = g.seats.filter((s) => s && !s.isAlex && s.phase === 'wait').length; occ[b] += w; if (!w) empty[b]++; samples[b]++; }
    const t = g.t;
    if (holdUntil >= 0) { if (!g.st.ipa.pulling || t >= holdUntil) { g.releasePull(); holdUntil = -1; ready = t + p.tap; } continue; }
    if (t < ready) continue;
    const act = botDecide(g, p, r, 1);
    if (!act) { ready = t + 0.05; continue; }
    if (act.kind === 'serve' || act.kind === 'alex') { g.serve(act.seat); ready = t + p.think + p.tap; }
    else if (act.kind === 'discard') { g.discardSlot(act.slot); ready = t + p.tap; }
    else { const res = g.press(act.pos); if (res === 'pull') holdUntil = t + Math.max(0.05, (0.93 + gauss(r) * p.pullSd / cfg.pullFull - g.st.ipa.fill) * cfg.pullFull); else ready = t + p.tap; }
  }
}
console.log(`Rythme, ${N} parties, bot ${prof}, sans Alex ni Hugo`);
console.log('tranche       arrivées  dont doubles  en attente (moy)  bar vide  partis');
for (let b = 0; b < B; b++) {
  const lab = `${b * W}-${b === B - 1 ? 120 : (b + 1) * W} s`.padEnd(13);
  console.log(lab, (arr[b] / N).toFixed(1).padStart(8), (dbl[b] / N).toFixed(1).padStart(13), (occ[b] / Math.max(1, samples[b])).toFixed(2).padStart(17), (Math.round(100 * empty[b] / Math.max(1, samples[b])) + ' %').padStart(9), (left[b] / N).toFixed(2).padStart(7));
}
