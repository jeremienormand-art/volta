// ─────────────────────────────────────────────────────────────
// MAIN — démarrage, boucle, contrôles tactiles, réactions de Max, écrans et panneau de test.
// ─────────────────────────────────────────────────────────────
const STEP = GAME_STEP;   // v1.30 : le même pas que la vérification des scores (src/core.js)
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ga1.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ga1.' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
};

// ── Mode public et mode test (v1.25) ──
// Public : l'adresse du QR code (son nom contient THEME.motPublic, « volta »). Pas de panneau de réglages, pas de boutons A/H,
// pas de bot ; les règles sont toujours celles par défaut, seul le confort (son, vibrations…) reste sur le téléphone.
// Test : `?test` dans l'adresse, le lien claude.ai, le fichier ouvert en local, `wrangler dev`. Tout y reste disponible.
const TEST = (() => {
  try { return /(^|&)test(=|&|$)/.test(location.search.slice(1)) || !location.hostname.toLowerCase().includes(THEME.motPublic); }
  catch (e) { return false; }
})();
const PUBLIC_COMFORT = RANK_COMFORT.filter((k) => k !== 'showZones');
// Valeurs par défaut remplacées depuis : un vieux téléphone qui les a enregistrées ne doit pas les garder (v1.25 : Hugo 10 → 14).
const OLD_DEFAULTS = { hugoTargetTirage: 10 };
// Seuls les réglages différents des valeurs par défaut sont enregistrés : un nouvel équilibrage arrive chez tout le monde.
function storedSettings() {
  const raw = store.get('cfg2', {}) || {}, d = {};
  for (const k of Object.keys(DEFAULTS)) if (k in raw && raw[k] !== DEFAULTS[k] && raw[k] !== OLD_DEFAULTS[k]) d[k] = raw[k];
  return d;
}
function loadSettings() {
  const d = storedSettings();
  if (TEST) return Object.assign({}, DEFAULTS, d);
  const keep = {}; for (const k of PUBLIC_COMFORT) if (k in d) keep[k] = d[k];
  return Object.assign({}, DEFAULTS, keep);
}
let settings = loadSettings();
let best = store.get('best16', { simple: 0, tirage: 0 }); // v1.6 : rythme par paliers, records repartis de zéro
let history = store.get('history', []);
let seen = store.get('seen2', {});
Coach.learned = store.get('learn1', {});
Coach.onLearn = (k) => {
  store.set('learn1', Coach.learned);
  if (k === 'serve') say('Bien joué, continue !', 1.6, true);
};
let g = null, cfg = settings, screen = 'title', paused = false;
let acc = 0, last = 0, lastInput = 0, lastBeep = 0;
const view = { s: 1, ox: 0, oy: 0, H: 640, dpr: 1 };
const canvas = $('cv');
const ctx = canvas.getContext('2d');
const flags = { hintPick: false, hintStout: false, hintDouble: false };

function saveSettings() {
  // En public, seul le confort est réécrit : les réglages de test enregistrés (adresse avec ?test) ne sont pas effacés.
  const d = TEST ? {} : storedSettings();
  for (const k of Object.keys(DEFAULTS)) {
    if (!TEST && !PUBLIC_COMFORT.includes(k)) continue;
    if (settings[k] !== DEFAULTS[k]) d[k] = settings[k]; else delete d[k];
  }
  store.set('cfg2', d);
  fillMode();
}

// ── Finesse d'affichage (v1.32) ──
// Pleine finesse de l'écran (jusqu'à ×3) tant que le téléphone suit. S'il peine en partie (moins de 45 images par seconde
// en moyenne sur 2 s), le canvas passe en ×2 : 2,25 fois moins de pixels à redessiner, dessins identiques à l'œil nu
// (les images du jeu ne sont pas plus fines que ×2), petits textes à peine plus doux. Réévalué à chaque ouverture.
let dprCap = 3;
const frameWatch = { n: 0, sum: 0 };
function watchFrames(dt) {   // appelée seulement en partie (ni pause, ni compte à rebours)
  if (dprCap <= 2 || (window.devicePixelRatio || 1) <= 2 || !(dt > 0)) return;
  frameWatch.n++; frameWatch.sum += dt;
  if (frameWatch.sum < 2) return;                                  // bilan toutes les 2 s, même sur un téléphone très lent
  if (frameWatch.n / frameWatch.sum < 45) { dprCap = 2; resize(); }
  frameWatch.n = 0; frameWatch.sum = 0;
}

// ── Mise à l'échelle : 360 px de large, ancré en bas, hauteur 590 à 860 ──
function resize() {
  const app = $('app');
  const r = app.getBoundingClientRect();
  const cw = Math.max(1, r.width), ch = Math.max(1, r.height);
  const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  // Marge de 12 px de chaque côté : on ne pose pas le doigt dans la zone des gestes « retour » du téléphone.
  const m = 12;
  let s = (cw - 2 * m) / 360, H = ch / s;
  if (H < 590) { H = 590; s = ch / 590; }
  if (H > 860) H = 860;
  view.s = s; view.H = H; view.dpr = dpr;
  view.ox = (cw - 360 * s) / 2; view.oy = ch - H * s;
  computeLayout(H);
  L.padX = view.ox / s;   // marge latérale, en unités du jeu : décor et voiles la remplissent
  const f = $('frame');
  f.style.left = view.ox + 'px'; f.style.top = view.oy + 'px';
  f.style.width = 360 * s + 'px'; f.style.height = H * s + 'px';
  f.style.setProperty('--s', s);
  f.style.setProperty('--padx', view.ox + 'px');
}

// ── Contrôles ──
// Toucher une boisson la pose sur le plateau. Glisser (depuis la boisson ou le plateau) jusqu'à un client le sert.
// Toucher un client le sert aussi. Toucher un verre du plateau le jette.
const P = { id: null, mode: null, sx: 0, sy: 0, moved: false, slot: -1 };
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s };
}
function zoneAt(x, y) {
  if (y < L.hudH) return { kind: 'hud' };
  const i = Math.max(0, Math.min(3, Math.floor(x / 90)));
  if (y <= L.counterBot) return { kind: 'seat', i };
  if (y >= L.stTop - 10) return { kind: 'station', i };
  return { kind: 'band' };
}
function seatOver(p) { return (p.y >= L.hudH && p.y <= L.counterBot) ? Math.max(0, Math.min(3, Math.floor(p.x / 90))) : -1; }
function traySlotAt(x, y) {
  if (y < L.maxTop + 26 || y > L.maxBot) return -1;
  const max = g.trayMax();
  for (let i = 0; i < g.tray.length; i++) if (Math.abs(x - traySlotX(TRAY.cx, i, max)) <= TRAY.sp / 2) return i;
  return -1;
}
function canPlay() { return screen === 'play' && g && !paused && V.countdown <= 0 && !g.over && g.freeze <= 0; }

// Sert le plateau au client ; from = où se trouve le plateau à l'écran (pour l'animation)
function serveAt(seat, from) {
  V.serveFrom = from || { cx: TRAY.cx, by: trayHomeY() };
  return g.serve(seat);
}
function tryReleaseHold() {
  if (g && g.hold && g.cut && g.cut.t > HOLD_MIN[g.cut.kind]) { g.releaseHold(); return true; }
  return false;
}

function onDown(e) {
  e.preventDefault();
  Sfx.unlock();
  if (screen === 'play' && g && !paused && g.hold) { tryReleaseHold(); return; }
  if (!canPlay()) return;
  if (P.id !== null) onEnd();
  P.id = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* */ }
  const p = toLogical(e);
  P.sx = p.x; P.sy = p.y; P.moved = false; P.slot = -1; P.band = false;
  lastInput = V.now;
  const z = zoneAt(p.x, p.y);
  if (z.kind === 'station') {
    g.setPressing(true);
    const res = g.press(z.i);
    V.press.pos = z.i; V.press.t = V.now;
    if (res === 'pull') { P.mode = 'pull'; V.pullAt = { x: p.x, y: p.y }; }
    else if (res === 'pick') P.mode = 'drag';
    else P.mode = 'none';
  } else if (z.kind === 'seat') {
    serveAt(z.i);
    P.mode = 'none';
  } else if (z.kind === 'band') {
    if (g.tray.length) { P.mode = 'drag'; P.band = true; P.slot = traySlotAt(p.x, p.y); }
    else {
      say(pick(['Oui ?', 'Je bosse, là.', 'Sers les clients !', 'On se connaît ?']), 1);
      V.max.bounce = 0.6;
      P.mode = 'none';
    }
  } else P.mode = 'none';
  drain();
}
function onMove(e) {
  if (e.pointerId !== P.id || !g) return;
  const p = toLogical(e);
  if (!P.moved && Math.hypot(p.x - P.sx, p.y - P.sy) > 10) P.moved = true;
  if (P.mode === 'pull') {
    V.pullAt = { x: p.x, y: p.y };
    V.hoverSeat = P.moved ? seatOver(p) : -1;
  } else if (P.mode === 'drag' && P.moved && g.tray.length) {
    V.drag = { x: p.x, y: p.y };
    V.hoverSeat = seatOver(p);
  }
}
function onEnd() {
  if (!g) { P.id = null; return; }
  if (P.mode === 'pull') {
    const seat = V.hoverSeat;
    V.directServe = seat >= 0;
    const q = g.releasePull();
    if (q && seat >= 0) serveAt(seat, { cx: V.pullAt.x, by: V.pullAt.y - 50 });
  } else if (P.mode === 'drag' && V.drag && V.hoverSeat >= 0 && g.tray.length) {
    const r = serveAt(V.hoverSeat, { cx: V.drag.x, by: V.drag.y - 50 });
    if (r === 'none' && coachGuardsTray(cfg)) coachNudge('miss'); // lâché sur une place vide
  } else if (P.mode === 'drag' && !P.moved && P.band && coachGuardsTray(cfg)) {
    coachNudge('tapTray'); // pendant le guidage, toucher le plateau ne jette pas le verre : on rappelle de glisser
  } else if (P.mode === 'drag' && !P.moved && P.slot >= 0) {
    g.discardSlot(P.slot);
  } else if (P.mode === 'drag' && P.moved && V.hoverSeat < 0 && g.tray.length && coachGuardsTray(cfg)) {
    coachNudge('miss');
  }
  g.setPressing(false);
  P.id = null; P.mode = null;
  drain();
  V.drag = null; V.hoverSeat = -1; V.pullAt = null; V.directServe = false;
}
canvas.addEventListener('pointerdown', onDown, { passive: false });
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', (e) => { if (e.pointerId === P.id) onEnd(); });
canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === P.id) onEnd(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (screen === 'play' && !paused) e.preventDefault(); }, { passive: false });

// Clavier (ordinateur) : 1-4 stations, A Z E R pour servir, Retour arrière pour jeter un verre, espace pour la pause
const keyHeld = {};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (screen === 'play' && g && g.hold && !paused) { tryReleaseHold(); e.preventDefault(); return; }
  if (k === ' ' || k === 'escape') { if (screen === 'play') { paused ? resume() : pause(); e.preventDefault(); } return; }
  if (!canPlay()) return;
  Sfx.unlock();
  lastInput = V.now;
  const st = '1234'.indexOf(k);
  if (st >= 0) { keyHeld[k] = true; g.setPressing(true); g.press(st); V.press.pos = st; V.press.t = V.now; drain(); return; }
  if (k === 'backspace') { g.discardSlot(g.tray.length - 1); drain(); return; }
  const seat = { a: 0, q: 0, z: 1, w: 1, e: 2, r: 3 }[k];
  if (seat !== undefined) { serveAt(seat); drain(); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (keyHeld[k] && g) { keyHeld[k] = false; g.releasePull(); g.setPressing(false); drain(); }
});

// ── Réactions aux événements du jeu ──
function drain() {
  if (!g) return;
  while (g.events.length) { const evs = g.events.splice(0); for (const e of evs) onEvent(e); }
}
function seatTop() { return L.bubbleY - 36; }
function firstTime(key) {
  if (!cfg.explain || seen[key]) return false;
  seen[key] = true; store.set('seen2', seen);
  return true;
}
function onEvent(e) {
  const c = cfg;
  coachEvent(g, c, e);
  switch (e.type) {
    case 'spawn': {
      const s = g.seats[e.seat];
      friendEvent(e, s);
      if (!s || !c.hints) break;
      if (s.tuto && !coachStep(g, c)) { // le coach montre déjà le geste : Max se tait
        const d = s.orders[0].drink, simple = c.prep === 'simple';
        const line = d === 'ipa' ? (simple ? 'Touche le chocolat : il va au plateau.' : 'Chocolat : maintiens, lâche dans le rose !')
          : d === 'spritz' ? 'Un expresso : un toucher suffit.'
            : (simple ? 'Un matcha : un toucher aussi.' : 'Matcha : lance-le, puis reviens !');
        say(line, 3, true);
      } else if (s.dbl && !flags.hintDouble && g.trayMax() > 1) {
        flags.hintDouble = true;
        say('Binôme de muscu : deux commandes !', 2.8, true);
      }
      break;
    }
    case 'pick': {
      Sfx.pick(); Haptics.buzz(6);
      const max = g.trayMax();
      if (!V.directServe) {
        const sp = stationX(g, e.drink);
        V.flys.push({ kind: 'tray', slot: e.slot, drink: e.drink, fill: e.fill === undefined ? 1 : e.fill, x0: (e.drink === 'spritz' || e.drink === 'shot') ? sp.x - 10 : sp.x, y0: L.stTop + 98, x1: traySlotX(TRAY.cx, e.slot, max), y1: trayHomeY() - 2, s0: 1.5, s1: 1.1, t: 0, dur: 0.16 });
      }
      if (e.fill !== undefined) { // verdict du tirage, là où le joueur regardait
        const at = V.gaugeAt || { x: stationX(g, 'ipa').x, y: L.stTop - 40 };
        if (e.q === 'perfect') { Sfx.perfect(); floatText(at.x, at.y + 10, 'PARFAIT !', C.rose, 22, 1.1); setMood('proud', 0.8); }
        else if (e.q === 'low') { Sfx.noGlass(); floatText(at.x, at.y + 10, 'PAS ASSEZ !', C.warn, 18, 1.1); setMood('oops', 0.8); if (Coach.learned.hold || !c.hints) say('Trop vide : remaintiens le chocolat !', 2, true); }
        else floatText(at.x, at.y + 10, e.topUp ? 'COMPLÉTÉE' : 'BIEN', C.creme, 16, 0.8);
      }
      if (c.hints && !flags.hintPick && Coach.learned.serve && g.seats.some((s) => s && s.tuto)) {
        flags.hintPick = true;
        say(max > 1 ? 'Glisse le plateau vers le client !' : 'Glisse le plateau jusqu’au client !', 2.4, true);
      }
      break;
    }
    case 'pullStart': Sfx.pullStart(); V.pullIn = false; if (e.topUp) say('On la complète…', 1, true); break;
    case 'pullCancel': Sfx.pullStop(); if (c.hints && Coach.learned.hold) say('Garde le doigt appuyé pour verser.', 1.4, true); break;
    case 'overflow': {
      Sfx.pullStop(); Sfx.overflow(); setMood('oops', 0.8); say(pick(['Ça déborde !', 'Ça déborde !']), 1, true);
      const at = V.gaugeAt || { x: stationX(g, 'ipa').x, y: L.stTop - 40 };

      break;
    }
    case 'trayFull':
      Sfx.busy(); V.press.bad = V.now; V.trayFlash = V.now;
      say('Plateau plein : sers d’abord !', 1.2, true);
      break;
    case 'discard': {
      Sfx.discard();
      if (g.trayMax() > 1) floatText(traySlotX(TRAY.cx, e.slot || 0, g.trayMax()), trayHomeY() - 40, 'à l’évier', C.cremeD, 11, 0.7);
      break;
    }
    case 'stoutLaunch':
      Sfx.launch();
      if (c.hints && !flags.hintStout && !coachStep(g, c)) { flags.hintStout = true; say('Il infuse : sers les autres !', 1.8, true); }
      break;
    case 'stoutReady': Sfx.ready(); break;
    case 'stoutBusy': Sfx.busy(); V.press.bad = V.now; say('Il infuse !', 0.8); break;
    case 'serve': {
      friendEvent(e, g.seats[e.seat]);
      Sfx.clink(Math.min(4, Math.floor(e.combo / 5))); Sfx.coin(e.mult); Haptics.buzz(10);
      const x = L.seatX[e.seat], max = g.trayMax();
      const from = V.serveFrom || { cx: TRAY.cx, by: trayHomeY() };
      e.slots.forEach((k, i) => {
        const dx = e.n > 1 ? (i - (e.n - 1) / 2) * 22 : 0;
        V.flys.push({ kind: 'serve', seat: e.seat, drink: e.drinks[i], fill: e.fills ? e.fills[i] : 1, dx, x0: traySlotX(from.cx, k, max), y0: from.by - 2, x1: x + dx, y1: L.counterTop + 9, s0: 1.1, s1: 1, t: 0, dur: 0.15 });
      });
      floatText(x, seatTop(), '+' + e.pts, e.ev > 1 ? C.rose : C.creme, 17);
      if (e.perfects) floatText(x, seatTop() + 24, 'PARFAIT', C.rose, 12, 0.9);

      V.max.bounce = 1;
      setMood(e.perfects ? 'proud' : 'happy', 0.5);
      if (e.boost === 0) say('Fin du bonus de Marie.', 1.3, true);
      else if (Math.random() < 0.22) say(pick(['Et voilà !', 'Servi !', 'Suivant !', 'Bonne séance !', 'Avec le sourire.']), 0.9);
      break;
    }
    case 'comboLevel':
      Sfx.comboUp(e.mult);
      floatText(160, L.maxTop - 34, `COMBO ×${String(e.mult).replace('.', ',')}`, e.mult >= 3 ? C.rose : C.orange, 20);
      say(e.mult >= 3 ? 'En feu !' : e.mult >= 2 ? 'On est chauds !' : 'Ça tourne !', 1.1, true);
      setMood('hot', 1);
      break;
    case 'wrong': {
      friendEvent(e, g.seats[e.seat]);
      Sfx.wrong(); Haptics.buzz(40);
      floatText(L.seatX[e.seat], seatTop(), '−' + e.pen, C.bad, 17);
      setMood('oops', 0.9); V.max.shake = 1; V.shake = 0.5;
      say(pick(['Pas pour lui !', 'Il veut autre chose…', 'Mauvais client !', 'Ah. Pardon.']), 1, true);
      break;
    }
    case 'left':
      friendEvent(e, g.seats[e.seat]);
      Sfx.left(); Haptics.buzz(25);
      floatText(L.seatX[e.seat], seatTop(), '−' + e.pen, C.bad, 17);
      setMood('sad', 1); say(pick(['Il est parti…', 'Reviens !', 'Ça fait mal.']), 1.1, true);
      break;
    case 'noGlass': Sfx.noGlass(); say('Prends une commande d’abord !', 1, true); break;
    case 'tooLow': // le client parle (bulle « Pas assez remplie ! ») ; Max dit comment réparer
      Sfx.noGlass(); Haptics.buzz(30); V.trayFlash = V.now;
      if (!e.partial) { setMood('oops', 0.9); V.max.shake = 0.6; }
      say('Trop vide : remaintiens le chocolat !', 2.2, true);
      break;
    case 'swap': Sfx.swap(); break;
    case 'alexTelegraph': Sfx.alexHey(); setMood('wary', 1.2); say('Oh non… Michel.', 1.1, true); break;
    case 'alexOffer': Sfx.alexHey(); setMood('wary', 0.8); say('Michel a une blague… points ×' + String(c.alexMult).replace('.', ',') + ' ?', 2, true); break;
    case 'alexIgnored': say('Plus tard, Michel !', 1.2, true); break;
    case 'alexCut':
      Sfx.laugh(); if (P.id !== null) onEnd();
      if (firstTime('alex_' + c.alexMode)) g.waitTap();
      break;
    case 'alexEffect':
      Sfx.swap();
      say(c.alexMode === 'inversion' ? 'Malaise… sers l’inverse !' : 'Les postes ont bougé !', 1.8, true);
      break;
    case 'alexEnding': say('Ça passe…', 1.2, true); break;
    case 'alexEnd':   // Volta : bonus de Michel si aucune erreur pendant la blague
      Sfx.ready(); setMood('happy', 0.8);
      if (e.clean) { Sfx.coin(2); say(`Zéro faute malgré la blague : +${e.clean} !`, 2, true); floatText(160, L.maxTop - 34, '+' + e.clean, C.gold, 20); }
      else say('Bon… on oublie cette blague.', 1.3, true);
      break;
    case 'hugoCut':
      Sfx.hugoAlarm(); if (P.id !== null) onEnd();
      if (firstTime('hugo')) g.waitTap();
      break;
    case 'hugoStart': say('Oui chef !', 1.2, true); break;
    // ── Jérémie, le contrôle qualité (v1.26) ──
    case 'jeremieCut':
      Sfx.stamp(); if (P.id !== null) onEnd();
      if (firstTime('jeremie')) g.waitTap();
      break;
    case 'jeremieArrive': {
      const s = g.seats[e.seat];
      if (e.tipsy) { Sfx.ready(); setMood('wary', 1); say('Encore elle ?', 1.3, true); if (s) talk(s, 'Fin de séance… j’ai faim !', 2.2); }
      break;   // premier passage : il parle à la fin du carton (jeremieGo)
    }
    case 'jeremieGo': { const s = g.seats[e.seat]; say('Un chocolat parfait pour Marie !', 1.8, true); if (s) talk(s, 'Un chocolat, s’il te plaît.', 2); break; }
    case 'jeremieTaste': {
      const s = g.seats[e.seat], from = V.serveFrom || { cx: TRAY.cx, by: trayHomeY() };
      V.flys.push({ kind: 'taste', seat: e.seat, drink: e.drink || 'ipa', fill: e.fill, x0: traySlotX(from.cx, e.slot, g.trayMax()), y0: from.by - 2, x1: L.seatX[e.seat] + 20, y1: L.custBase - 30, s0: 1.1, s1: 0.9, t: 0, dur: 0.18 });
      Sfx.gulp(); setMood('sweat', 1.3);
      if (s) talk(s, s.tipsy ? 'Miam…' : 'Hmm…', 1.1);
      break;
    }
    case 'jeremieApprove': {
      const s = g.seats[e.seat], mult = String(c.jeremieMult).replace('.', ',');
      Sfx.stamp(); Sfx.perfect(); Haptics.buzz(20);
      if (e.shot) { // v1.37 : pompette, on lui a servi un shot : p'tit bonus en plus du ×2
        Sfx.coin(2); setMood('happy', 1.6); say(`Un croissant ! +${e.shot} et points ×${mult}`, 2.4, true);
        if (s) { talk(s, 'Un croissant ? Tu me connais trop bien !', 2.8); floatText(L.seatX[e.seat], L.bubbleY + 12, '+' + e.shot, C.gold, 18, 1.2); }
        break;
      }
      if (e.odd) { // v1.35 : pompette, il a validé une stout, un spritz ou une pinte à moitié vide
        setMood('happy', 1.4); say(`Elle n’a rien vu… points ×${mult} !`, 2.2, true);
        if (s) talk(s, pick(({ stout: ['Un chocolat… bien vert. J’adore.', 'Beau chocolat. Très… matcha.'], spritz: ['Un chocolat très serré ? Audacieux.', 'Notes de café… très marquées.'] })[e.drink] || ['Un peu court… mais validé.', 'La moitié, c’est déjà ça.']), 2.4);
        break;
      }
      setMood('proud', 1.4); say(`Approuvé ! Points ×${mult} sur ${e.boost} clients`, 2.2, true);
      if (s) talk(s, e.tipsy ? pick(['C’est… le meilleur chocolat du monde.', 'Je t’aime bien, toi.', 'Parfait. Tout est parfait.']) : pick(['Ça, c’est un chocolat.', 'Rien à redire. Je valide.', 'Bien onctueux. Approuvé.']), 2);
      break;
    }
    case 'jeremieReject': {
      const s = g.seats[e.seat];
      Sfx.stamp(); Sfx.fail(); Haptics.buzz(30);
      if (e.last) { setMood('sad', 1.2); say('Elle a noté…', 1.4, true); if (s) talk(s, 'Bon… je note.', 1.8); }
      else { setMood('oops', 1); say('La zone dorée, la zone dorée…', 1.8, true); if (s) talk(s, pick(e.over ? ['Ça déborde… À refaire.', 'Notes de cacao… et de débordement.'] : ['Trop juste. Encore un.', 'Notes de cacao… et de précipitation.']), 2); }
      break;
    }
    case 'jeremieAgain': break;   // la bulle de commande revient : il en attend une autre
    case 'jeremieStale': { // v1.34 : la pinte a été tirée avant son arrivée
      const s = g.seats[e.seat];
      Sfx.noGlass(); Haptics.buzz(30); V.trayFlash = V.now; setMood('oops', 0.8);
      say('Un chaud, versé devant elle !', 2, true);
      if (s) talk(s, pick(['Il traîne depuis quand, celui-là ?', 'Verse-le devant moi.', 'Un bien chaud, s’il te plaît.']), 2);
      break;
    }
    case 'jeremieWrong': { const s = g.seats[e.seat]; Sfx.wrong(); Haptics.buzz(30); setMood('oops', 0.8); if (s) talk(s, 'Un chocolat, j’ai dit.', 1.6); break; }
    case 'jeremieVerdict':
      if (e.v === 'parti') { const s = g.seats[e.seat]; Sfx.left(); setMood('sad', 1); say('Raté pour le contrôle…', 1.4, true); if (s) talk(s, 'Je repasserai.', 1.6); }
      break;
    case 'tick': Sfx.tick(e.left <= 5); break;
    case 'hugoEnd':
      // v1.20 : Hugo donne son verdict en personne, fier ou déçu.
      // v1.25 : médaille selon le palier (bronze, argent, or = la demande d'Hugo) ; Hugo fier à l'or, bras croisés sinon.
      const med = `${['', 'Bronze', 'Argent', 'Or'][e.tier]} · +${e.bonus} · ${e.served} / ${e.target}`;
      const hugoFace = (mood) => ({ spec: HUGO_SPEC, mood });
      if (e.perfect) { banner('SERVICE IMPECCABLE !', `Or · +${e.bonus} · zéro faute`, 'rose', 2.2, { face: hugoFace('proud'), medal: 3 }); Sfx.win(); setMood('triumph', 1.4); }
      else if (e.tier === 3) { banner('OBJECTIF TENU !', med, 'blanc', 2, { face: hugoFace('proud'), medal: 3 }); Sfx.win(); setMood('proud', 1.2); }
      else if (e.tier === 2) { banner('PAS MAL !', med, 'blanc', 2, { face: hugoFace('idle'), medal: 2 }); Sfx.ready(); setMood('happy', 1); }
      else if (e.tier === 1) { banner('ÇA PASSE…', med, 'blanc', 2, { face: hugoFace('idle'), medal: 1 }); Sfx.ready(); setMood('oops', 1); }
      else { banner('FABIEN SOUPIRE…', `${e.served} / ${e.target} commandes`, 'faible', 2.1, { face: hugoFace('sad') }); Sfx.fail(); setMood('sad', 1.2); }
      break;
    case 'pace': { // palier de difficulté : Max le sent passer (sauf pendant Alex et Hugo, qui parlent déjà)
      if (g.eventBusy()) break;
      const lines = ['', 'Ça se remplit !', 'Ça accélère !', 'L’heure de pointe !', 'Ça ne s’arrête plus !', 'Plein service !'];
      say(e.doubles ? 'Les binômes de muscu arrivent !' : lines[e.level] || 'Ça accélère !', 1.4);
      break;
    }
    case 'lastCall': Sfx.bell(); banner('DERNIÈRE COMMANDE !', 'plus personne n’entre', 'orange', 2.3, { bell: true }); break;
    case 'over': gameOver(); break;
  }
}

// ── Cycle de vie ──
function startGame() {
  Sfx.unlock();
  cfg = Object.assign({}, settings);
  Sfx.on = cfg.sound; Haptics.on = cfg.haptics; V.zones = cfg.showZones;
  // Classement : partie classée si les réglages sont ceux par défaut. v1.27 (Jérémie) : chaque partie est différente,
  // classée ou non (clients et événements au hasard) ; plus de graine commune de la semaine.
  const seed = cfg.seed || ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  Rank.begin(cfg, seed);   // v1.30 : la graine est confiée au serveur avec le jeton, avant de jouer
  // v1.26 : en public, Jérémie arrive avec ses dessins ; menu d'événements tiré au hasard à chaque partie
  g = new Game(cfg, seed, { noJeremie: !TEST && !JEREMIE_IN_PAGE });
  g.guide = cfg.hints && !Coach.learned.serve;
  auto.ready = 0; auto.hold = -1;   // bot de test : repart de zéro à chaque partie (il attendait l'heure de la partie précédente)
  coachReset();
  Object.assign(V, { floats: [], flys: [], served: [], banner: null, shake: 0, drag: null, hoverSeat: -1, countdown: 0, overT: -1,
    pullAt: null, pullIn: false, gaugeAt: null, serveFrom: null, directServe: false, trayFlash: -9, spot: 0, spotHoles: [], lastCombo: 0, comboBreak: -9, comboPop: -9, openT: 0, talk: [], met: {}, pendingSay: null });
  Object.assign(V.max, { mood: 'idle', moodUntil: 0, say: '', sayUntil: 0, bounce: 0, shake: 0 });
  flags.hintPick = false; flags.hintStout = false; flags.hintDouble = false;
  acc = 0; paused = false; screen = 'play'; lastInput = V.now;
  showScreen(null);
  $('hud').hidden = false;
  $('bTestA').hidden = $('bTestH').hidden = $('bTestJ').hidden = !cfg.testButtons;
  updateMuteIcon();
  armBackGuard();
  Sfx.shutterUp();
  banner('C’EST OUVERT !', null, 'rose', 1.5, { delay: 0.55 });
}
function gameOver() {
  V.overT = 0;
  Sfx.pullStop(); Sfx.shutter();
  if (P.id !== null) { P.id = null; P.mode = null; V.drag = null; V.pullAt = null; }
  const key = cfg.prep;
  const rec = g.score > (best[key] || 0);
  if (rec) { best[key] = g.score; store.set('best16', best); }
  const s = g.stats;
  const entry = {
    v: 2, at: new Date().toISOString(), score: g.score, prep: cfg.prep, trayMax: cfg.trayMax, alexMode: cfg.alexMode, alexShot: cfg.alexShot,
    alexOn: cfg.alexOn, hugoOn: cfg.hugoOn, duration: cfg.duration, drinks: s.drinks, errors: s.errors, left: s.left,
    perfect: s.perfect, combo: g.bestCombo, hugo: s.hugoPlayed ? `${s.hugoServed}/${s.hugoTarget}` : null,
    hugoOk: s.hugoReached, hugoPerfect: s.hugoPerfect, hugoTier: s.hugoTier, alexPasses: s.alexPasses, alexErrors: s.alexErrors, alexClean: s.alexClean || 0,
    alexIgnored: s.alexIgnored, rating: null, difficulty: cfg.difficulty, refused: s.refused, low: s.low, learnPause: Math.round(s.learnPause),
    menu: g.menu, jeremie: s.jeremieVerdicts.slice(),
  };
  history.unshift(entry); history = history.slice(0, 30); store.set('history', history);
  const gm = g, gc = cfg;
  setTimeout(() => { if (g !== gm) return; Sfx.print(); if (rec) setTimeout(() => Sfx.record(), 1000); fillEnd(entry, rec); Rank.onEnd(gm, gc); showScreen('sEnd'); screen = 'over'; $('hud').hidden = true; }, 1500);
}
// ── Geste « retour » (v1.10) ──
// Pendant une partie, l'adresse prend #partie (une entrée d'historique). Un retour accidentel (bord de l'écran,
// bouton retour d'Android) la retire : on met en pause au lieu de quitter. Un second retour quitte normalement.
const BACK_GUARD = '#partie';
function armBackGuard() { try { if (location.hash !== BACK_GUARD) location.hash = BACK_GUARD; } catch (e) { /* historique indisponible */ } }
window.addEventListener('hashchange', () => {
  if (location.hash === BACK_GUARD) return;
  if (screen === 'play' && g && !paused && !g.over) { pause(); $('pBack').hidden = false; $('pSay').hidden = true; }
});
function pause() {
  if (screen !== 'play' || paused || !g || g.over) return;
  paused = true;
  $('pBack').hidden = true; $('pSay').hidden = false;
  Sfx.pullStop();
  if (P.id !== null) onEnd();
  fillPause();
  showScreen('sPause');
}
// v1.44 : pause au comptoir : la partie en cours sur trois ardoises, Max qui commente
function fillPause() {
  const left = Math.max(0, Math.ceil(g.cfg.duration - g.t)), cm = comboMult(g.combo), nx = nextComboStep(g.combo);
  const from = g.combo >= 10 ? 10 : g.combo >= 5 ? 5 : 0;
  $('pTime').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('pTime').classList.toggle('low', left <= 20);
  $('pScore').textContent = g.score.toLocaleString('fr-FR');
  let crans = '';
  if (nx) { const n = 5, on = Math.round(((g.combo - from) / (nx - from)) * n); for (let i = 0; i < n; i++) crans += `<i${i < on ? ' class="on"' : ''}></i>`; }
  $('pCombo').innerHTML = `<b>${multLabel(cm)}</b>${crans ? `<span class="p-crans" aria-hidden="true">${crans}</span>` : ''}`;
  $('pSay').textContent = left <= 20 ? `Plus que ${left} secondes. On finit fort ?`
    : cm >= 2 ? 'Ton combo t’attend au chaud.'
    : 'Je t’attends. Les clients aussi…';
}
function resume() {
  if (!paused) return;
  armBackGuard();
  showScreen(null);
  V.countdown = 1.5; lastBeep = 4;
  setTimeout(() => { paused = false; }, 0);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ── Boucle ──
function frame(ts) {
  requestAnimationFrame(frame);
  // v1.30 : jusqu'à 0,25 s de jeu par image (16 pas) : un téléphone qui rame saute des images au lieu de jouer au ralenti
  // (avant : 50 ms au plus, et une partie plus facile sur un téléphone lent ou ralenti exprès).
  const dtR = Math.min(0.25, last ? (ts - last) / 1000 : 0);
  last = ts;
  if (V.countdown > 0) {
    const n = Math.ceil(V.countdown / 0.5);
    if (n !== lastBeep) { lastBeep = n; Sfx.beep(false); }
  }
  if (screen === 'play' && g && !paused && V.countdown <= 0 && !g.over) {
    watchFrames(dtR);
    acc += dtR * cfg.slowmo;
    let n = 0;
    while (acc >= STEP && n < 16) { g.setLearnPause(coachStep(g, cfg)); g.step(STEP); acc -= STEP; n++; drain(); if (auto.on) autoStep(); }
    if (n >= 16) acc = 0;
    if (g.st.ipa.pulling === false && Sfx.pullNode) Sfx.pullStop();
    if (g.st.ipa.pulling) { // un petit « ding » quand la pinte entre dans la zone parfaite
      const f = g.st.ipa.fill, inZ = g.jerWants() ? g.brewOk(f) : f >= cfg.perfectLo && f <= cfg.perfectHi;   // v1.29 : le « ding » suit la zone dorée quand Jérémie attend
      if (inZ && !V.pullIn) { Sfx.zone(); Haptics.buzz(8); }
      V.pullIn = inZ;
    }
    if (V.now - lastInput > 5 && !V.coach && g.seats.some((s) => s && !s.isAlex && s.phase === 'wait')) {
      lastInput = V.now; say(pick(['Ils attendent !', 'Hé, le service !', 'On dort ?']), 1.2);
    }
  }
  updateView(dtR, screen === 'title' ? null : g);
  draw();
}
function draw() {
  const d = view.dpr;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = C.nuit;
  ctx.fillRect(0, 0, canvas.width / d, canvas.height / d);
  ctx.setTransform(d * view.s, 0, 0, d * view.s, d * view.ox, d * view.oy);
  ctx.save();
  ctx.beginPath(); ctx.rect(-L.padX, 0, 360 + 2 * L.padX, L.H); ctx.clip();
  renderGame(ctx, screen === 'title' ? null : g, screen === 'title' ? settings : cfg);
  ctx.restore();
}

// ── Écrans ──
function showScreen(id) {
  for (const s of ['sTitle', 'sPause', 'sEnd', 'sPanel', 'sRank']) $(s).hidden = s !== id;
  $('sStory').hidden = true;   // v1.40 : l'image de story ne reste pas affichée en changeant d'écran
}
function modeLabel(c) {
  const prep = c.prep === 'simple' ? 'Service simple' : 'Service avec tirage';
  const tray = (c.trayMax || 1) > 1 ? `Plateau de ${c.trayMax}` : 'Un verre à la fois';
  const alex = !c.alexOn ? 'sans Michel' : `Michel : ${c.alexMode === 'miroir' ? 'postes à l’envers' : 'commandes inversées'}, ${c.alexShot === 'impose' ? 'imposé' : 'au choix'}`;
  const hugo = c.hugoOn ? 'Fabien' : 'sans Fabien';
  const jer = !c.jeremieOn ? 'sans Marie' : c.menu === 'hasard' ? 'Marie (menu au hasard)' : ({ alex: 'menu Michel', jeremie: 'menu Marie', tous: 'menu complet' })[c.menu];
  return [prep, tray, alex, hugo, jer];
}
function fillTitle() {
  const c = settings, tray = (c.trayMax || 1) > 1;
  const b = best[c.prep] || 0;
  $('tBest').innerHTML = b
    ? `<span class="t-star" aria-hidden="true"></span>Ton record${c.prep === 'simple' ? ' (simple)' : ''} <strong>${b.toLocaleString('fr-FR')}</strong>`
    : 'Pas encore de record';
  $('tStep2').textContent = tray ? 'le plateau' : 'le verre';
  const dur = c.duration || 120;   // v1.17 : Max ne dévoile plus la montée par paliers, le joueur la découvre en jouant
  $('tSay').textContent = `${dur >= 120 ? 'Deux minutes' : dur + ' secondes'} de service. Le comptoir va vite se remplir !`;
  // v1.24 : arrivé par un lien de défi, Max annonce le score à battre (à la place du n° 1 de la semaine)
  if (DEFI) {
    const who = DEFI.de || 'Un pote';
    $('tSay').textContent = DEFI.won
      ? `Défi de ${DEFI.de || 'ton pote'} relevé ! À ton tour de le défier.`
      : `${who} te défie : ${DEFI.score.toLocaleString('fr-FR')} points à battre !`;
  }
}
// Les illustrations de l'accueil réutilisent les atlas du jeu (aucune image en double dans la page).
function paintMenuArt() {
  const app = $('app');
  const set = (k, img) => app.style.setProperty(k, `url("${img.src}")`);
  set('--img-team', TEAM); set('--img-drinks', DRINK_ART); set('--img-tray', SERVING_TRAY);
  set('--img-cust', CUSTOMERS); set('--img-icons', UI_ICONS); set('--img-wood', SERVICE_PANEL);
  set('--menu-frame', STATION_PANEL);   // v1.25 : ardoise des menus = celle des stations (une seule copie dans la page)
  set('--img-maxf', ART.maxAccueil); set('--img-ticket', ART.ticket); set('--img-ardoise', ART.ardoise);
  document.documentElement.classList.add('art');   // les règles .art utilisent ces images
}
function fillMode() {
  const el = $('pMode');
  if (el) el.innerHTML = modeLabel(settings).map((m) => `<span class="chip">${m}</span>`).join('');
}
function fillEnd(e, rec) {
  $('eScore').textContent = e.score.toLocaleString('fr-FR');
  $('eRecord').hidden = !rec;
  const d = new Date(e.at || Date.now()), two = (n) => String(n).padStart(2, '0');
  $('eMeta').textContent = `Service du ${two(d.getDate())}/${two(d.getMonth() + 1)} à ${two(d.getHours())}h${two(d.getMinutes())} · barista : Etienne`;
  const rows = [
    ['Commandes servies', e.drinks],
    ...(e.prep === 'tirage' ? [['Chocolats parfaits', e.perfect]] : []),
    ...(e.refused ? [['Chocolats trop vides', e.refused]] : []),
    ['Erreurs', e.errors],
    ['Clients partis', e.left],
    ['Meilleur combo', e.combo],
  ];
  if (e.hugo) rows.push(['Visite client', `${e.hugo} ${e.hugoPerfect ? 'or, 0 faute' : ['raté', 'bronze', 'argent', 'or'][e.hugoTier || 0]}`]);
  // v1.26 : le verdict du brasseur, passage par passage
  if (e.jeremie && e.jeremie.length) rows.push(['Marie', e.jeremie.map((v) => ({ approuve: 'approuvé', pompette: 'affamée', shot: 'croissant +' + (cfg.jeremieShotBonus || 0), revoir: 'à revoir', parti: 'raté' })[v] || v).join(', ')]);
  if (e.alexOn && e.alexPasses) rows.push(['Blague de Michel', e.alexIgnored && e.alexIgnored >= e.alexPasses ? 'refusée' : e.alexClean ? `zéro faute +${e.alexClean}` : `${e.alexErrors} erreur${e.alexErrors > 1 ? 's' : ''}`]);
  $('eStats').innerHTML = rows.map(([k, v]) => `<div class="r-line"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  // v1.39 : les caractéristiques de la partie ne servent qu'aux testeurs (en public, les règles sont toujours celles par défaut)
  // Volta : plus de ligne des réglages ni d'avis sur l'addition, même en test (demande de Jérémie)
  lastEnd = e;
  lastEnd.rec = !!rec;   // v1.40 : le tampon « Nouveau record » aussi sur l'image de story
  fillDefi(e);
  resetShare();
  fillInsta();
  resetStory();
}

// ── Instagram du bar (v1.38, v1.39) ──
// Tant que le joueur n'a jamais touché le néon de la barre du bas, il y reste, visible sans défiler.
// Une fois touché (retenu sur le téléphone), il laisse la place au rappel discret en pied de ticket : on ne relance pas un abonné.
function fillInsta() {
  if (!THEME.insta) { $('bInsta').hidden = $('eInsta').hidden = true; return; }   // Volta : pas encore de compte Instagram
  const done = !!store.get('insta', 0);
  $('bInsta').hidden = done;
  $('eInsta').hidden = !done;
  $('bInsta').classList.remove('ok');
  $('bInstaL').textContent = 'Suis-nous sur Insta';
  $('bInstaS').textContent = '@' + THEME.insta;
}
function instaTapped() {
  store.set('insta', Date.now());
  // Le lien s'ouvre dans un autre onglet (ou l'appli Instagram) ; au retour, le néon remercie. Il disparaîtra à la partie suivante.
  $('bInsta').classList.add('ok');
  $('bInstaL').textContent = 'Merci !';
  $('bInstaS').textContent = 'À bientôt ' + THEME.chezLieu;
}

// ── Story Instagram (v1.40) ──
// Le score devient une image de story (src/story.js) : feuille de partage du téléphone avec l'image (Instagram > Story).
// Instagram ne laisse pas pré-taguer un compte : le @ est écrit sur l'image et le bouton rappelle de taguer.
// Sans partage d'image (ordinateur, page claude.ai, vieux navigateur) : l'image s'affiche, appui long pour l'enregistrer.
function storyInfo(e) {
  const rows = [['Commandes servies', e.drinks]];
  if (e.prep === 'tirage') rows.push(['Chocolats parfaits', e.perfect]);
  rows.push(['Meilleur combo', e.combo]);
  if (e.hugo) rows.push(['Visite client', `${e.hugo} ${e.hugoPerfect ? 'or' : ['raté', 'bronze', 'argent', 'or'][e.hugoTier || 0]}`]);
  const rank = [], r = Rank.end && Rank.end.sent && Rank.last;   // classement de cette partie, s'il est connu
  if (r && r.record) rank.push(r.rang === 1 ? '1er de la semaine !' : `${rankOrd(r.rang)} de la semaine`);
  const t = r && r.tout;
  if (t && t.record && t.rang <= 10) rank.push(t.rang === 1 ? 'Record absolu du jeu !' : `Et ${rankOrd(t.rang)} de tous les temps !`);
  const defi = DEFI && e.score > DEFI.score ? `Défi de ${DEFI.de || 'mon pote'} relevé !` : '';
  return { score: e.score, at: e.at, rows, record: !!e.rec, rank, defi };
}
let storyTimer = 0;
function resetStory() { clearTimeout(storyTimer); $('eStory').classList.remove('ok'); $('eStoryL').textContent = 'Ton score en story'; $('eStoryS').textContent = STORY_TAG; }
function flashStory(label, sub) {
  $('eStory').classList.add('ok'); $('eStoryL').textContent = label; $('eStoryS').textContent = sub;
  clearTimeout(storyTimer); storyTimer = setTimeout(resetStory, 6000);
}
// v1.42 (Jérémie : la feuille de partage n'ouvre pas Instagram en mode Story) : une page web ne peut pas l'ouvrir directement
// (réservé aux applis du téléphone, avec un identifiant Meta). Le toucher sur le ticket montre donc d'abord l'image et les
// trois étapes ; « Partager » ouvre ensuite la feuille de partage avec l'image déjà prête (un geste neuf, partage immédiat).
let storyShot = null;
const canShareFile = (f) => { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); } catch (err) { return false; } };
function showStory(s, share) {
  storyShot = s;
  $('sStoryImg').src = s.url;
  $('sStoryDl').href = s.url; $('sStoryDl').download = s.name;
  // Dans une page encadrée (le lien claude.ai), les téléchargements sont bloqués : on garde l'appui long et « Fermer ».
  let framed = false; try { framed = window.self !== window.top; } catch (err) { framed = true; }
  $('sStorySteps').hidden = !share; $('sStoryGo').hidden = !share;
  $('sStoryHelp').hidden = share;
  $('sStoryT').textContent = share ? 'Ta story est prête' : 'Ton score en image';
  $('sStoryDl').hidden = share || framed;
  $('sStoryBtns').classList.toggle('solo', !share && framed);
  $('sStory').hidden = false;
}
function shareStory() {
  if (!lastEnd) return;
  let s = null;
  try { s = storyFile(storyInfo(lastEnd)); } catch (err) { s = null; }
  if (!s) { flashStory('Image indisponible', 'Réessaie dans un instant'); return; }
  if (window.__galopins) window.__galopins.story = { name: s.name, size: s.file.size, url: s.url };   // pour les tests
  showStory(s, canShareFile(s.file));
}
function storyGo() {
  const s = storyShot;
  if (!s) return;
  navigator.share({ files: [s.file] }).then(
    () => { $('sStory').hidden = true; flashStory('Story prête !', STORY_TAG); },
    (err) => { if (!(err && err.name === 'AbortError')) showStory(s, false); });   // partage refusé : appui long
}

// ── Défi entre potes (v1.24) ──
// « Défier un pote » partage l'adresse publique avec le score à battre : …workers.dev/?defi=22450&de=Jérémie.
// Le pote qui l'ouvre voit le défi dans la bulle de Max à l'accueil, puis le verdict sur son addition.
// Sur le lien claude.ai aussi, le lien partagé mène à l'adresse publique (celle du QR code).
const PUBLIC_URL = THEME.urlPublique;
const DEFI = (() => {
  try {
    const q = new URLSearchParams(location.search);
    const score = Math.round(Number(q.get('defi')));
    if (!(score > 0 && score <= 90000)) return null;   // même plafond que le classement
    const de = String(q.get('de') || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
    return { score, de, won: false };
  } catch (e) { return null; }
})();
let lastEnd = null;
function fillDefi(e) {
  const el = $('eDefi');
  el.hidden = !DEFI;
  if (!DEFI) return;
  const fmt = (n) => n.toLocaleString('fr-FR'), diff = e.score - DEFI.score;
  if (diff > 0) DEFI.won = true;
  el.className = 'r-defi' + (diff > 0 ? ' won' : '');
  const head = `${DEFI.de ? `Défi de <b>${esc(DEFI.de)}</b>` : 'Le défi'} : ${fmt(DEFI.score)}`;
  el.innerHTML = diff > 0 ? `${head}<strong>Défi relevé !</strong><small>${fmt(diff)} points d’avance</small>`
    : diff === 0 ? `${head}<strong>Égalité !</strong><small>Pile le même score</small>`
    : `${head}<strong>Pas encore…</strong><small>Il te manque ${fmt(-diff)} points</small>`;
}
function shareText() {
  const e = lastEnd;
  if (!e) return null;
  const pts = `${e.score.toLocaleString('fr-FR')} points`;
  const r = Rank.end && Rank.end.sent && Rank.last;   // inscription de cette partie au classement
  const rang = r && r.record ? `, ${rankOrd(r.rang)} de la semaine` : '';
  const nom = Rank.name;
  const text = DEFI && e.score > DEFI.score
    ? `J’ai relevé le défi${DEFI.de ? ' de ' + DEFI.de : ''} : ${pts} sur ${THEME.jeu}${rang}. Tu me bats ? ${THEME.emoji}`
    : `J’ai fait ${pts} sur ${THEME.jeu}${rang}. Tu me bats ? ${THEME.emoji}`;
  const url = `${PUBLIC_URL}?defi=${e.score}${nom ? '&de=' + encodeURIComponent(nom) : ''}`;
  return { text, url };
}
let shareTimer = 0;
function resetShare() { clearTimeout(shareTimer); $('bShare').classList.remove('ok'); $('bShareL').textContent = 'Défier un pote'; }
function flashShare(label) {
  $('bShare').classList.add('ok'); $('bShareL').textContent = label;
  clearTimeout(shareTimer); shareTimer = setTimeout(resetShare, 2600);
}
async function shareScore() {
  const s = shareText();
  if (!s) return;
  if (window.__galopins) window.__galopins.shared = s;   // pour les tests (mode test seulement)
  // Téléphone : la feuille de partage (WhatsApp, Messages…). Ailleurs, ou si elle est bloquée : on copie le message.
  if (navigator.share) {
    try { await navigator.share({ title: THEME.jeu, text: s.text, url: s.url }); return; }
    catch (err) { if (err && err.name === 'AbortError') return; }
  }
  const all = `${s.text} ${s.url}`;
  let ok = false;
  try { await navigator.clipboard.writeText(all); ok = true; } catch (err) {
    try {
      const t = document.createElement('textarea');
      t.value = all; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove();
    } catch (err2) { ok = false; }
  }
  flashShare(ok ? 'Lien copié !' : 'Copie bloquée');
}

$('bStart').addEventListener('click', startGame);
$('bReplay').addEventListener('click', startGame);
$('bRankPlay').addEventListener('click', startGame);   // v1.45 : depuis le top 10
$('bShare').addEventListener('click', shareScore);
$('bInsta').addEventListener('click', instaTapped);
$('eStory').addEventListener('click', shareStory);
$('sStoryClose').addEventListener('click', () => { $('sStory').hidden = true; });
$('sStoryGo').addEventListener('click', storyGo);
$('bEndPanel').addEventListener('click', () => openPanel('sEnd'));
$('bEndMenu').addEventListener('click', () => { screen = 'title'; g = null; fillTitle(); showScreen('sTitle'); });
$('bTitlePanel').addEventListener('click', () => openPanel('sTitle'));
$('bResume').addEventListener('click', resume);
$('bRestart').addEventListener('click', startGame);
$('bQuit').addEventListener('click', () => { paused = false; screen = 'title'; g = null; $('hud').hidden = true; fillTitle(); showScreen('sTitle'); });
$('bPausePanel').addEventListener('click', () => openPanel('sPause'));
$('bPause').addEventListener('click', () => pause());
$('bMute').addEventListener('click', () => { settings.sound = !settings.sound; cfg.sound = settings.sound; Sfx.on = settings.sound; saveSettings(); updateMuteIcon(); });
$('bTestA').addEventListener('click', () => { if (!g) return; if (g.forceAlex()) drain(); else say('Un événement à la fois !', 1.2, true); });
$('bTestH').addEventListener('click', () => { if (!g) return; if (g.forceHugo()) drain(); else say(g.t > cfg.duration - 26 ? 'Trop tard pour Fabien.' : 'Un événement à la fois !', 1.2, true); });
$('bTestJ').addEventListener('click', () => { if (!g) return; if (g.forceJeremie()) drain(); else say('Un événement à la fois !', 1.2, true); });
function updateMuteIcon() { $('bMute').setAttribute('aria-pressed', String(!settings.sound)); $('bMute').title = settings.sound ? 'Couper le son' : 'Remettre le son'; }

// ── Panneau de test ──
const fmtN = (x) => String(x).replace('.', ',');
const PANEL = [
  { section: 'Mécaniques à comparer', note: 'Change un réglage, joue deux ou trois parties, note ton ressenti à la fin. L’historique en bas garde la trace.' },
  { key: 'prep', label: 'Préparation des boissons', type: 'seg', options: [['simple', 'Simple'], ['tirage', 'Tirage']], help: { simple: 'Toutes les boissons au toucher. Pur arcade.', tirage: 'Chocolat au maintien (parfait = bonus), matcha lancé puis repris.' } },
  { key: 'trayMax', label: 'Plateau d’Etienne', type: 'seg', options: [[1, '1 verre'], [2, '2 verres'], [3, '3 verres']], help: { 1: 'Un verre à la fois, comme la version 1.', 2: 'Juste assez pour une commande double.', 3: 'De quoi servir plusieurs clients d’affilée.' } },
  { key: 'alexMode', label: 'Effet de Michel', type: 'seg', options: [['inversion', 'Commandes inversées'], ['miroir', 'Tireuses à l’envers']], help: { miroir: 'Les postes échangent leurs places. Les bulles restent vraies.', inversion: 'Les bulles se retournent : chocolat ⇄ matcha, expresso ⇄ croissant.' } },
  { key: 'alexShot', label: 'La blague de Michel', type: 'seg', options: [['choix', 'Au choix'], ['impose', 'Imposé']], help: { impose: 'Michel débarque et raconte sa blague, sans demander.', choix: 'Michel arrive avec sa blague : touche-le pour l’écouter, ou ignore-le.' } },
  { key: 'alexMult', label: 'Points pendant Michel', type: 'seg', options: [[1, '×1'], [1.5, '×1,5'], [2, '×2']] },
  { key: 'alexOn', label: 'Michel', type: 'toggle' },
  { key: 'hugoOn', label: 'Fabien', type: 'toggle' },
  { key: 'jeremieOn', label: 'Marie (contrôle qualité)', type: 'toggle' },
  { key: 'menu', label: 'Événements de la partie', type: 'seg', options: [['hasard', 'Au hasard'], ['alex', 'Michel'], ['jeremie', 'Marie'], ['tous', 'Les trois']], help: { hasard: 'Fabien à chaque partie, plus Michel ou Marie (une chance sur deux). Jamais les trois.', alex: 'Michel et Fabien, comme avant.', jeremie: 'Marie passe deux fois (la seconde, affamée) et Fabien. Pas de Michel.', tous: 'Pour tester seulement : Marie tôt, puis Michel, puis Fabien. Le hasard ne le tire jamais.' } },
  { section: 'Rythme' },
  { key: 'duration', label: 'Durée de partie', type: 'seg', options: [[90, '90 s'], [120, '120 s']] },
  { key: 'difficulty', label: 'Cadence des clients', type: 'range', min: 0.6, max: 1.6, step: 0.05, fmt: (x) => '×' + fmtN(x) },
  { key: 'patienceMult', label: 'Patience des clients', type: 'range', min: 0.6, max: 1.6, step: 0.05, fmt: (x) => '×' + fmtN(x) },
  { key: 'stepEvery', label: 'Difficulté : un palier de plus toutes les', type: 'range', min: 10, max: 30, step: 5, fmt: (x) => x + ' s' },
  { key: 'pullFull', label: 'Temps pour remplir un chocolat', type: 'range', min: 0.4, max: 1.0, step: 0.02, fmt: (x) => fmtN(x.toFixed(2)) + ' s' },
  { key: 'goodLo', label: 'Chocolat : niveau minimum accepté', type: 'range', min: 0.4, max: 0.8, step: 0.02, fmt: (x) => Math.round(x * 100) + ' %' },
  { key: 'stoutRest', label: 'Infusion du matcha', type: 'range', min: 0.8, max: 3, step: 0.1, fmt: (x) => fmtN(x.toFixed(1)) + ' s' },
  { key: 'alexDuration', label: 'Durée de l’effet de Michel', type: 'range', min: 6, max: 20, step: 1, fmt: (x) => x + ' s' },
  { key: 'hugoDuration', label: 'Durée du rush de Fabien', type: 'range', min: 10, max: 30, step: 1, fmt: (x) => x + ' s' },
  { key: 'hugoTargetTirage', label: 'Objectif de Fabien, tirage', type: 'range', min: 6, max: 20, step: 1, fmt: (x) => x + ' boissons' },
  { key: 'hugoTargetSimple', label: 'Objectif de Fabien, simple', type: 'range', min: 6, max: 24, step: 1, fmt: (x) => x + ' boissons' },
  { key: 'doubles', label: 'Commandes doubles (binômes de muscu)', type: 'toggle' },
  { section: 'Scènes de Michel et Fabien' },
  { key: 'explain', label: 'La première fois, attendre un toucher pour lire la règle', type: 'toggle' },
  { key: 'cutAlex', label: 'Durée de la scène de Michel ensuite', type: 'range', min: 1.5, max: 5, step: 0.1, fmt: (x) => fmtN(x.toFixed(1)) + ' s' },
  { key: 'cutHugo', label: 'Durée de la scène de Fabien ensuite', type: 'range', min: 1.5, max: 5, step: 0.1, fmt: (x) => fmtN(x.toFixed(1)) + ' s' },
  { type: 'action', label: 'Revoir les explications', done: 'Le guidage du premier service et les scènes reviendront à la prochaine partie.', run: () => { seen = {}; store.set('seen2', seen); Coach.learned = {}; store.set('learn1', Coach.learned); } },
  // v1.41 : le néon Instagram ne revient plus une fois touché (v1.39) ; ce bouton le fait revenir sur ce téléphone, pour tester ou le montrer
  { type: 'action', label: 'Revoir le néon Instagram', done: 'Le néon « Suis-nous sur Insta » reviendra sur la prochaine addition.', run: () => { store.set('insta', 0); } },
  { section: 'Confort' },
  { key: 'sound', label: 'Son', type: 'toggle' },
  { key: 'haptics', label: 'Vibrations (Android)', type: 'toggle' },
  { key: 'sway', label: 'Tangage pendant Michel', type: 'toggle' },
  { key: 'hints', label: 'Guidage des premiers gestes', type: 'toggle' },
  { section: 'Outils de test' },
  { key: 'showZones', label: 'Afficher les zones tactiles', type: 'toggle' },
  { key: 'testButtons', label: 'Boutons A, H et J en jeu (déclencher Michel, Fabien, Marie)', type: 'toggle' },
  { key: 'slowmo', label: 'Vitesse', type: 'seg', options: [[1, 'Normale'], [0.6, 'Ralenti']] },
  { key: 'seed', label: 'Clients', type: 'seg', options: [[0, 'Aléatoires'], [4242, 'Toujours les mêmes']], help: { 0: 'Chaque partie est différente.', 4242: 'Même partie à chaque fois : idéal pour comparer deux réglages.' } },
];
let panelBack = 'sTitle';
function openPanel(from) { if (!TEST) return; panelBack = from; buildPanel(); fillMode(); showScreen('sPanel'); $('sPanel').scrollTop = 0; }
$('bPanelClose').addEventListener('click', () => {
  saveSettings();
  if (panelBack === 'sTitle') fillTitle();
  if (panelBack === 'sPause') { Sfx.on = settings.sound; Haptics.on = settings.haptics; cfg.sound = settings.sound; cfg.haptics = settings.haptics; cfg.sway = settings.sway; cfg.showZones = settings.showZones; V.zones = settings.showZones; }
  showScreen(panelBack);
});
$('bPanelReset').addEventListener('click', () => { settings = Object.assign({}, DEFAULTS); saveSettings(); buildPanel(); });
function buildPanel() {
  const box = $('pControls');
  box.innerHTML = '';
  for (const it of PANEL) {
    if (it.section) {
      const h = document.createElement('h3'); h.textContent = it.section; box.appendChild(h);
      if (it.note) { const p = document.createElement('p'); p.className = 'note'; p.textContent = it.note; box.appendChild(p); }
      continue;
    }
    const row = document.createElement('div'); row.className = 'row row-' + it.type;
    const id = 'f_' + (it.key || 'act');
    if (it.type === 'action') {
      row.innerHTML = `<button type="button" class="ghost wide" id="${id}">${it.label}</button><p class="help" hidden></p>`;
      row.querySelector('button').addEventListener('click', () => { it.run(); const h = row.querySelector('.help'); h.textContent = it.done; h.hidden = false; });
    } else if (it.type === 'toggle') {
      row.innerHTML = `<label for="${id}">${it.label}</label><input type="checkbox" role="switch" id="${id}" ${settings[it.key] ? 'checked' : ''}>`;
      row.querySelector('input').addEventListener('change', (e) => { settings[it.key] = e.target.checked; saveSettings(); });
    } else if (it.type === 'range') {
      row.innerHTML = `<div class="rlab"><label for="${id}">${it.label}</label><output id="${id}_o">${it.fmt(settings[it.key])}</output></div><input type="range" id="${id}" min="${it.min}" max="${it.max}" step="${it.step}" value="${settings[it.key]}">`;
      row.querySelector('input').addEventListener('input', (e) => { const v = +e.target.value; settings[it.key] = v; row.querySelector('output').textContent = it.fmt(v); saveSettings(); });
    } else {
      const opts = it.options.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(settings[it.key]) === String(v)}">${l}</button>`).join('');
      row.innerHTML = `<div class="slab" id="${id}">${it.label}</div><div class="seg" role="group" aria-labelledby="${id}">${opts}</div>${it.help ? `<p class="help"></p>` : ''}`;
      const help = row.querySelector('.help');
      const upd = () => { if (help) help.textContent = it.help[settings[it.key]] || ''; };
      upd();
      row.querySelector('.seg').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const raw = b.dataset.v; const v = typeof DEFAULTS[it.key] === 'number' ? +raw : raw;
        settings[it.key] = v; saveSettings();
        for (const x of row.querySelectorAll('.seg button')) x.setAttribute('aria-pressed', String(x === b));
        upd();
      });
    }
    box.appendChild(row);
  }
  renderHistory();
}

// Simulateur : un bot joue des parties avec les réglages actuels
let simBusy = false;
$('pSimRun').addEventListener('click', () => {
  if (simBusy) return;
  simBusy = true;
  const prof = document.querySelector('#pSimProf button[aria-pressed="true"]').dataset.v;
  const out = $('pSimOut');
  out.innerHTML = '<p class="note">Simulation en cours…</p>';
  const N = 120, res = {};
  const jobs = ['simple', 'tirage'];
  const runs = { simple: [], tirage: [] };
  let i = 0;
  const tick = () => {
    const t0 = performance.now();
    while (i < N * 2 && performance.now() - t0 < 30) {
      const prep = jobs[i < N ? 0 : 1];
      const c = Object.assign({}, settings, { prep, slowmo: 1 });
      runs[prep].push(runBotGame(c, (9001 + (i % N) * 7919) >>> 0, BOT_PROFILES[prof]));
      i++;
    }
    out.innerHTML = `<p class="note">Simulation en cours… ${Math.round(100 * i / (N * 2))} %</p>`;
    if (i < N * 2) { setTimeout(tick, 0); return; }
    res.simple = summarize(runs.simple); res.tirage = summarize(runs.tirage);
    const pct = (x) => Math.round(x * 100) + ' %';
    const n1 = (x) => fmtN(x.toFixed(1));
    const rows = [
      ['Score moyen', (s) => Math.round(s.score).toLocaleString('fr-FR')],
      ['Score, 1 partie sur 10 au-dessus de', (s) => Math.round(s.p90).toLocaleString('fr-FR')],
      ['Boissons servies', (s) => n1(s.drinks)],
      ['Clients partis', (s) => n1(s.left)],
      ['Erreurs', (s) => n1(s.errors)],
      ['Chocolats parfaits', (s) => n1(s.perfect)],
      ['Fabien : boissons en moyenne', (s) => settings.hugoOn ? `${n1(s.hugoServed)} / ${s.hugoTarget}` : '—'],
      ['Fabien : argent ou mieux', (s) => settings.hugoOn ? pct(s.hugoArgent) : '—'],
      ['Fabien : or (la demande)', (s) => settings.hugoOn ? pct(s.hugoReached) : '—'],
      ['Fabien : service impeccable', (s) => settings.hugoOn ? pct(s.hugoPerfect) : '—'],
    ];
    out.innerHTML = `<div class="tbl"><table><thead><tr><th>${BOT_PROFILES[prof].label}, ${N} parties</th><th>Simple</th><th>Tirage</th></tr></thead><tbody>${rows.map(([k, f]) => `<tr><th>${k}</th><td>${f(res.simple)}</td><td>${f(res.tirage)}</td></tr>`).join('')}</tbody></table></div><p class="note">Le bot lit parfaitement les bulles : un humain fera moins bien, surtout pendant Michel. Ces chiffres servent à caler les objectifs, pas à juger le plaisir.</p>`;
    simBusy = false;
  };
  setTimeout(tick, 20);
});
$('pSimProf').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  for (const x of $('pSimProf').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
});

function renderHistory() {
  const box = $('pHist');
  if (!history.length) { box.innerHTML = '<p class="note">Aucune partie jouée pour l’instant.</p>'; return; }
  const rate = { bof: 'Bof', bien: 'Bien', top: 'Top' };
  box.innerHTML = `<div class="tbl"><table><thead><tr><th>Réglage</th><th>Score</th><th>Fabien</th><th>Ressenti</th></tr></thead><tbody>${history.slice(0, 15).map((h) => {
    const alex = !h.alexOn ? 'sans Michel' : `${h.alexMode === 'miroir' ? 'miroir' : 'inversion'} ${h.alexShot === 'impose' ? 'imposé' : 'choix'}`;
    const tray = (h.trayMax || 1) > 1 ? `plateau ${h.trayMax}` : '1 verre';
    return `<tr><th>${h.prep === 'simple' ? 'Simple' : 'Tirage'} · ${tray} · ${alex}</th><td>${h.score.toLocaleString('fr-FR')}</td><td>${h.hugo ? h.hugo + (h.hugoOk ? ' ✓' : '') : '—'}</td><td>${h.rating ? rate[h.rating] : '—'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
$('pHistClear').addEventListener('click', () => { history = []; store.set('history', history); renderHistory(); });

// ── Jeu automatique (tests uniquement) : le bot du simulateur joue avec les vraies actions ──
const auto = { on: false, prof: null, ready: 0, hold: -1, r: mulberry32(7) };
function autoStep() {
  if (!g || g.over) return;
  if (g.hold) { tryReleaseHold(); return; }
  if (g.freeze > 0) return;
  const t = g.clock();
  if (auto.hold >= 0) {
    if (!g.st.ipa.pulling || t >= auto.hold) { g.releasePull(); g.setPressing(false); auto.hold = -1; auto.ready = t + auto.prof.tap; drain(); }
    return;
  }
  if (t < auto.ready) return;
  const act = botDecide(g, auto.prof, auto.r, 1);
  if (!act) { auto.ready = t + 0.05; return; }
  if (act.kind === 'serve' || act.kind === 'alex') { serveAt(act.seat); auto.ready = t + auto.prof.think + auto.prof.tap; }
  else if (act.kind === 'discard') { g.discardSlot(act.slot); auto.ready = t + auto.prof.tap; }
  else {
    V.press.pos = act.pos; V.press.t = V.now;
    const res = g.press(act.pos);
    if (res === 'pull') { g.setPressing(true); auto.hold = t + (0.93 - g.st.ipa.fill) * cfg.pullFull; } else auto.ready = t + auto.prof.tap;
  }
  drain();
}
// Hook de test (fait jouer le bot avec les vraies actions) : jamais sur l'adresse publique, il servirait à tricher au classement.
if (TEST) window.__galopins = {
  // v1.43 : mise en page de la story réglable depuis les tests (mode test seulement)
  storyLab: { layout: STORY_LAYOUT, draw: (info) => drawStory(info).toDataURL('image/jpeg', 0.9) },
  start: startGame, auto(p) { auto.on = true; auto.prof = BOT_PROFILES[p || 'bon']; }, get game() { return g; }, say(t) { say(t, 4, true); },
  friend(key) { const i = FRIENDS.findIndex((f) => f.key === key); const s = g && g.seats.find((c) => c && !c.isAlex && c.phase === 'wait'); if (i < 0 || !s) return false; s.look = 8 + i * 2; friendEvent({ type: 'spawn' }, s); return true; },
  get coach() { return { step: V.coach ? V.coach.kind : null, text: V.coachText, nudge: Coach.nudge && Coach.nudge.kind, learned: Object.assign({}, Coach.learned), paused: !!(g && g.learnPause), spot: V.spot }; },
};

// ── Démarrage ──
function boot(data) {
  if (TEST && data && data.settings && !store.get('cfg2', null)) settings = Object.assign({}, DEFAULTS, data.settings);
  // Mode public : ni panneau de réglages, ni lien « Réglages » sur l'addition et la pause.
  for (const id of ['bTitlePanel', 'bEndPanel', 'bPausePanel']) $(id).hidden = !TEST;
  $('bEndMenu').parentElement.classList.toggle('solo', !TEST);
  resize();
  paintMenuArt();
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  fillTitle();
  showScreen('sTitle');
  $('hud').hidden = true;
  Rank.defi = DEFI;   // le défi remplace le n° 1 de la semaine dans la bulle de Max
  Rank.init();
  const go = () => requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) {
    Promise.race([
      Promise.all([document.fonts.load(`28px ${FONT_P}`), document.fonts.load(`22px ${FONT_D}`), document.fonts.load(`700 12px ${FONT_T}`), document.fonts.load(`800 12px ${FONT_T}`)]),
      new Promise((r) => setTimeout(r, 1500)),
    ]).then(go, go);
  } else go();
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
  try { window.claude.hot.snapshot(() => ({ settings })); } catch (e) { /* */ }
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
else boot(window.claude && window.claude.hot ? window.claude.hot.data : {});
