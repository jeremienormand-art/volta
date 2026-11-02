// ─────────────────────────────────────────────────────────────
// BOT — un joueur simulé qui utilise exactement les mêmes actions que le doigt.
// Sert à vérifier que les objectifs (Hugo) sont atteignables et à comparer les mécaniques.
// ─────────────────────────────────────────────────────────────
const BOT_PROFILES = {
  // think : lecture et décision avant chaque service · tap : déplacement du pouce vers une cible
  debutant: { label: 'Débutant', think: 0.85, tap: 0.45, err: 0.07, pullSd: 0.09, smart: 0.4, alexAccept: 0.5 },
  bon:      { label: 'Bon joueur', think: 0.55, tap: 0.32, err: 0.03, pullSd: 0.05, smart: 0.8, alexAccept: 0.8 },
  expert:   { label: 'Expert', think: 0.36, tap: 0.24, err: 0.012, pullSd: 0.03, smart: 1, alexAccept: 1 },
};

function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function runBotGame(cfg, seed, prof) {
  const g = new Game(cfg, seed);
  const r = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const dt = 1 / 60;
  let ready = 0, holdUntil = -1;
  let effectStart = -1;
  while (!g.over) {
    g.step(dt);
    for (const e of g.events) if (e.type === 'alexEffect') effectStart = g.t;
    g.events.length = 0;
    if (g.freeze > 0) continue;
    const t = g.t;
    // maintien en cours sur l'IPA
    if (holdUntil >= 0) {
      if (!g.st.ipa.pulling) { holdUntil = -1; g.setPressing(false); ready = t + prof.tap; continue; }
      if (t >= holdUntil) { g.releasePull(); g.setPressing(false); holdUntil = -1; ready = t + prof.tap; }
      continue;
    }
    if (t < ready) continue;
    // surcoût de lecture pendant l'effet d'Alex
    let think = prof.think, errMul = 1;
    if (g.alexActive()) {
      const since = t - effectStart;
      if (cfg.alexMode === 'inversion') { think += 0.22; errMul = 3; }
      else if (since < 4) { think += 0.15; errMul = 2.5; }
      else { think += 0.05; errMul = 1.4; }
    }
    const act = botDecide(g, prof, r, errMul);
    if (!act) { ready = t + 0.05; continue; }
    if (act.kind === 'serve') { g.serve(act.seat); ready = t + think + prof.tap; }
    else if (act.kind === 'alex') { g.serve(act.seat); ready = t + think; }
    else if (act.kind === 'discard') { g.discardSlot(act.slot); ready = t + prof.tap; }
    else if (act.kind === 'press') {
      const res = g.press(act.pos);
      if (res === 'pull') {
        g.setPressing(true);
        const target = 0.93 + gauss(r) * prof.pullSd / cfg.pullFull;
        holdUntil = t + Math.max(0.05, (target - g.st.ipa.fill) * cfg.pullFull);   // un verre complété part de son niveau
      } else ready = t + prof.tap + (res === 'full' ? 0.2 : 0);
    }
  }
  const s = g.stats;
  return { score: g.score, served: s.served, drinks: s.drinks, errors: s.errors, left: s.left, perfect: s.perfect,
    low: s.low, refused: s.refused, overflow: s.overflow, hugoServed: s.hugoServed, hugoTarget: s.hugoTarget, hugoTier: s.hugoTier, hugoReached: s.hugoReached,
    hugoPerfect: s.hugoPerfect, hugoPlayed: s.hugoPlayed, bestCombo: g.bestCombo, alexErrors: s.alexErrors, alexDrinks: s.alexDrinks,
    discards: s.discards, menu: g.menu, jerVisits: s.jeremieVisits, jerApproved: s.jeremieApproved, jerRejected: s.jeremieRejected, jerBoosted: s.jeremieBoosted, alexPasses: s.alexPasses };
}

// v1.34 : « ipa+ » = IPA tirée depuis l'arrivée de Jérémie (sobre). Lui n'accepte qu'elle ; un client prend
// d'abord une IPA ordinaire, puis une « ipa+ ».
function botFind(t, d) { let i = t.indexOf(d); if (i < 0 && d === 'ipa') i = t.indexOf('ipa+'); return i; }
const botBase = (d) => (d === 'ipa+' ? 'ipa' : d);
// Combien de verres du plateau ce client prendrait
function botCovers(tray, needs) {
  const t = tray.slice(); let n = 0;
  for (const d of needs) { const i = botFind(t, d); if (i >= 0) { t.splice(i, 1); n++; } }
  return n;
}

function botDecide(g, prof, r, errMul) {
  // Alex propose un shot (mode choix)
  for (let i = 0; i < 4; i++) {
    const s = g.seats[i];
    if (s && s.isAlex && s.phase === 'offer') {
      if (s.botSeen === undefined) s.botSeen = r() < prof.alexAccept;
      if (s.botSeen) return { kind: 'alex', seat: i };
    }
  }
  const waiting = [];
  for (let i = 0; i < 4; i++) {
    const s = g.seats[i];
    if (!s || s.isAlex || (s.phase !== 'wait' && s.phase !== 'arrive')) continue;
    const needs = s.orders.filter((o) => !o.done).map((o) => g.need(o.drink)).map((d) => (s.isJer && !s.tipsy && d === 'ipa' ? 'ipa+' : d));
    if (needs.length) waiting.push({ seat: i, needs, f: s.patience / s.pmax, s });
  }
  if (!waiting.length) return null;
  if (r() < prof.smart) waiting.sort((a, b) => a.f - b.f);
  else waiting.sort(() => r() - 0.5);
  const err = prof.err * errMul;
  // une IPA trop vide ne compte pas comme une IPA : le bot la complète (en retirant l'IPA) ou la jette
  const jer = waiting.find((w) => w.s.isJer && !w.s.tipsy);
  const tray = g.tray.map((x) => (x.q === 'low' ? 'ipa-low' : x.drink === 'ipa' && jer && g.jerFresh(jer.s, x) ? 'ipa+' : x.drink));
  const max = g.trayMax();
  const full = tray.length >= max;
  const serveTo = (w) => (r() < err ? { kind: 'serve', seat: waiting[Math.floor(r() * waiting.length)].seat } : { kind: 'serve', seat: w.seat });

  // 1. un client dont toute la commande est sur le plateau : on sert
  if (tray.length) {
    const whole = waiting.find((w) => botCovers(tray, w.needs) === w.needs.length);
    if (whole) return serveTo(whole);
    const partial = waiting.find((w) => botCovers(tray, w.needs) > 0 && (full || w.f < 0.3));
    if (partial) return serveTo(partial);
  }
  // 2. lancer une stout si quelqu'un en attend une
  const stoutNeed = waiting.reduce((n, w) => n + w.needs.filter((d) => d === 'stout').length, 0) - tray.filter((d) => d === 'stout').length;
  if (g.gesture('stout') === 'rest' && g.st.stout.phase === 'idle' && stoutNeed > 0) return { kind: 'press', pos: g.layout.indexOf('stout') };
  // 3. aller chercher la prochaine boisson manquante, client prioritaire d'abord
  if (!full) {
    const avail = tray.slice();
    for (const w of waiting) {
      for (const d of w.needs) {
        const i = botFind(avail, d);
        if (i >= 0) { avail.splice(i, 1); continue; }
        if (g.gesture(botBase(d)) === 'rest' && g.st.stout.phase !== 'ready') continue;
        let pos = g.layout.indexOf(botBase(d));
        if (r() < err) pos = (pos + 1 + Math.floor(r() * 3)) % 4;
        return { kind: 'press', pos };
      }
    }
  }
  // 4. plateau plein : jeter un verre que personne ne veut, sinon servir partiellement
  if (full) {
    const wanted = [];
    for (const w of waiting) wanted.push(...w.needs);
    const k = tray.findIndex((d) => { let i = wanted.indexOf(d); if (i < 0 && d === 'ipa+') i = wanted.indexOf('ipa'); if (i >= 0) { wanted.splice(i, 1); return false; } return true; });
    if (k >= 0) return { kind: 'discard', slot: k };
  }
  const any = waiting.find((w) => botCovers(tray, w.needs) > 0);
  if (any) return serveTo(any);
  return null;
}

function simulate(cfg, n, profKey, seed0) {
  const prof = BOT_PROFILES[profKey];
  const runs = [];
  for (let i = 0; i < n; i++) runs.push(runBotGame(cfg, (seed0 + i * 7919) >>> 0, prof));
  return summarize(runs);
}

function summarize(runs) {
  const n = runs.length;
  const avg = (k) => runs.reduce((a, r) => a + (+r[k]), 0) / n;
  const scores = runs.map((r) => r.score).sort((a, b) => a - b);
  const q = (p) => scores[Math.min(n - 1, Math.floor(p * n))];
  const hp = runs.filter((r) => r.hugoPlayed);
  return {
    n, score: avg('score'), p10: q(0.1), p50: q(0.5), p90: q(0.9),
    served: avg('served'), drinks: avg('drinks'), errors: avg('errors'), left: avg('left'),
    perfect: avg('perfect'), overflow: avg('overflow'), low: avg('low'), refused: avg('refused'), bestCombo: avg('bestCombo'), discards: avg('discards'),
    hugoServed: hp.length ? hp.reduce((a, r) => a + r.hugoServed, 0) / hp.length : 0,
    hugoTarget: hp.length ? hp[0].hugoTarget : 0,
    hugoReached: hp.length ? hp.filter((r) => r.hugoReached).length / hp.length : 0,
    hugoPerfect: hp.length ? hp.filter((r) => r.hugoPerfect).length / hp.length : 0,
    hugoBronze: hp.length ? hp.filter((r) => r.hugoTier >= 1).length / hp.length : 0,
    hugoArgent: hp.length ? hp.filter((r) => r.hugoTier >= 2).length / hp.length : 0,
    alexErrors: avg('alexErrors'),
    jerVisits: avg('jerVisits'), jerApproved: avg('jerApproved'), jerRejected: avg('jerRejected'), jerBoosted: avg('jerBoosted'), alexPasses: avg('alexPasses'),
  };
}
