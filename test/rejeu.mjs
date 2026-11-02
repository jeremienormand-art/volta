// Anti-triche (v1.30) : une partie rejouée à partir de son journal de gestes retombe exactement sur le même score.
// node test/rejeu.mjs [parties]
// Le jeu tourne comme dans la page (src/, scripts classiques) ; le rejeu utilise worker/jeu.js, la copie que le Worker
// importe (node build.mjs la régénère). Le journal passe par JSON, comme sur le réseau. Pour éprouver le rejeu, le bot
// joue avec des maladresses : gestes au hasard, pauses d'apprentissage, scènes qui attendent un toucher, verres jetés.
import fs from 'node:fs';
import vm from 'node:vm';
import { replayGame, LOGIC_ID } from '../worker/jeu.js';

const dir = new URL('../src/', import.meta.url);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(['config.js', 'core.js', 'bot.js'].map((f) => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n') +
  '\nthis.API = { DEFAULTS, Game, BOT_PROFILES, botDecide, mulberry32, GAME_STEP };', ctx);
const { DEFAULTS, Game, BOT_PROFILES, botDecide, mulberry32, GAME_STEP } = ctx.API;

const N = +(process.argv[2] || 200);
const profs = ['debutant', 'bon', 'expert'];
let ok = 0, ko = 0, entries = 0, bytes = 0, maxBytes = 0;
const fails = [];
for (let i = 0; i < N; i++) {
  const seed = (1000 + i * 7919) >>> 0;
  const prof = BOT_PROFILES[profs[i % 3]];
  const cfg = Object.assign({}, DEFAULTS, { hints: i % 2 === 0 });
  const opts = { noJeremie: i % 5 === 0 };
  const g = new Game(cfg, seed, opts);
  g.guide = cfg.hints && i % 4 === 0;
  const r = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  let ready = 0, holdUntil = -1, learnUntil = -1, tapAt = -1;
  while (!g.over) {
    // pause d'apprentissage de temps en temps (comme le coach)
    if (learnUntil < 0 && r() < 0.002) learnUntil = g.n + 30 + Math.floor(r() * 200);
    g.setLearnPause(learnUntil >= 0 && g.n < learnUntil);
    if (learnUntil >= 0 && g.n >= learnUntil) learnUntil = -1;
    g.step(GAME_STEP);
    for (const e of g.events) if ((e.type === 'alexCut' || e.type === 'hugoCut' || e.type === 'jeremieCut') && r() < 0.6) { g.waitTap(); tapAt = g.n + 60 + Math.floor(r() * 120); }
    g.events.length = 0;
    if (tapAt >= 0 && g.n >= tapAt) { g.releaseHold(); tapAt = -1; }
    if (g.freeze > 0) continue;
    const t = g.t;
    // maladresses : un geste au hasard
    const x = r();
    if (x < 0.004) g.press(Math.floor(r() * 4));
    else if (x < 0.006) g.serve(Math.floor(r() * 4));
    else if (x < 0.007) g.discardSlot(Math.floor(r() * 3));
    else if (x < 0.008) { g.setPressing(true); g.setPressing(false); }
    if (holdUntil >= 0) {
      if (!g.st.ipa.pulling || t >= holdUntil) { g.releasePull(); g.setPressing(false); holdUntil = -1; ready = t + prof.tap; }
      continue;
    }
    if (t < ready) continue;
    const act = botDecide(g, prof, r, 1);
    if (!act) { ready = t + 0.05; continue; }
    if (act.kind === 'serve' || act.kind === 'alex') { g.serve(act.seat); ready = t + prof.think + prof.tap; }
    else if (act.kind === 'discard') { g.discardSlot(act.slot); ready = t + prof.tap; }
    else {
      g.setPressing(true);
      const res = g.press(act.pos);
      if (res === 'pull') holdUntil = t + (0.85 + r() * 0.3 - g.st.ipa.fill) * cfg.pullFull;
      else { g.setPressing(false); ready = t + prof.tap; }
    }
  }
  // comme sur le réseau : l'en-tête et le journal passent par JSON
  const rj = JSON.parse(JSON.stringify({ v: LOGIC_ID, graine: g.seed, guide: g.guide, hints: cfg.hints, opts: g.opts, pas: g.n, log: g.log }));
  const size = JSON.stringify(rj).length;
  entries += rj.log.length; bytes += size; maxBytes = Math.max(maxBytes, size);
  const h = replayGame(Object.assign({}, DEFAULTS, { hints: rj.hints }), rj.graine, rj.opts, rj);
  const same = h.score === g.score && h.n === g.n && h.stats.drinks === g.stats.drinks && h.bestCombo === g.bestCombo &&
    h.stats.errors === g.stats.errors && h.stats.left === g.stats.left && h.stats.hugoTier === g.stats.hugoTier;
  if (same) ok++; else { ko++; if (fails.length < 5) fails.push({ seed, jeu: g.score, rejeu: h.score, pas: [g.n, h.n] }); }
}
console.log(`${N} parties : ${ok} rejouées à l'identique, ${ko} écart(s) · journal moyen ${Math.round(entries / N)} gestes, ${(bytes / N / 1024).toFixed(1)} Ko (max ${(maxBytes / 1024).toFixed(1)} Ko)`);
if (ko) { console.log('Écarts :', JSON.stringify(fails)); process.exitCode = 1; }

// Un score inventé ne correspond à aucune partie : le rejeu donne le vrai score, pas celui annoncé.
const g = new Game(Object.assign({}, DEFAULTS), 4242, {});
while (!g.over) { g.step(GAME_STEP); g.events.length = 0; }
const faux = replayGame(Object.assign({}, DEFAULTS), 4242, {}, { log: [] });
console.log(`Partie sans geste : ${faux.score} points au rejeu (un score annoncé de 89 000 serait refusé)`);
