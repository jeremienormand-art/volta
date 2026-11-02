// Généré par build.mjs : ne pas modifier à la main (copie de src/config.js et src/core.js pour le Worker).
export const LOGIC_ID = 'f3f3fdf49e11';
// ─────────────────────────────────────────────────────────────
// CONFIG — tout l'équilibrage du jeu. Rien d'autre à toucher pour régler.
// Les valeurs sont des hypothèses de test, modifiables en jeu (panneau Réglages).
// ─────────────────────────────────────────────────────────────
const DRINKS = ['ipa', 'stout', 'spritz', 'shot'];
const DRINK_NAMES = { ipa: 'IPA', stout: 'Stout', spritz: 'Spritz', shot: 'Shot' };
// Alex « inversion » : correspondance fixe, une seule règle à retenir.
const INV = { ipa: 'stout', stout: 'ipa', spritz: 'shot', shot: 'spritz' };
const LAYOUT_NORMAL = ['ipa', 'stout', 'spritz', 'shot'];
const LAYOUT_MIRROR = ['shot', 'spritz', 'stout', 'ipa'];

// Paliers de difficulté : un cran de plus toutes les stepEvery secondes.
// iv : s entre deux arrivées · pat : patience des clients (s) · max : clients au comptoir au plus · dbl : part de commandes doubles
const PALIERS = [
  { iv: 3.2, pat: 18, max: 2, dbl: 0 },       //   0-20 s : on apprend, mais le bar ne reste pas vide
  { iv: 3.0, pat: 17, max: 3, dbl: 0 },       //  20-40 s
  { iv: 2.8, pat: 16, max: 3, dbl: 0.25 },    //  40-60 s : les tables de potes arrivent
  { iv: 2.5, pat: 16, max: 4, dbl: 0.35 },    //  60-80 s
  { iv: 2.2, pat: 14.5, max: 4, dbl: 0.45 },  //  80-100 s
  { iv: 1.9, pat: 13, max: 4, dbl: 0.5 },     // 100-120 s : coup de feu
];

const DEFAULTS = {
  // Partie
  duration: 120,            // s
  difficulty: 1,            // multiplie la cadence d'arrivée (1 = normal)
  patienceMult: 1,          // multiplie la patience des clients
  doubles: true,            // commandes doubles (tables de potes) à partir du troisième palier
  hints: true,              // guidage des premiers gestes (le chrono et les clients s'arrêtent pendant chaque consigne)

  // Préparation des boissons — LA comparaison principale
  prep: 'tirage',           // 'simple' : tout au toucher · 'tirage' : IPA au maintien, stout en deux temps
  trayMax: 3,               // verres sur le plateau de Max (1 = un verre à la fois, comme la v1)
  pullFull: 0.7,            // s de maintien pour remplir une IPA
  goodLo: 0.62,             // en dessous : pinte trop vide, refusée par le client (« Pas assez remplie ! ») ; se complète en remaintenant
  perfectLo: 0.82,          // zone de pinte parfaite (fraction du verre)
  perfectHi: 1.04,
  overflowAt: 1.2,          // au-delà : ça déborde, verre perdu
  stoutPour: 0.45,          // s, premier temps du tirage de stout
  stoutRest: 1.6,           // s de repos avant de pouvoir la prendre

  // Cadence par paliers (v1.6, retour d'Anaïs) : la difficulté monte d'un cran toutes les stepEvery s (voir PALIERS)
  stepEvery: 20,            // s par palier, pour une partie de 120 s (15 s en 90 s)
  emptyGap: 0.6,            // s : bar vide, délai avant le client suivant
  loneGap: 1.4,             // s : un seul client au comptoir, délai maximal avant le suivant

  // Alex — le shot de trop
  alexOn: true,
  alexMode: 'inversion',    // 'inversion' : les commandes s'inversent · 'miroir' : les tireuses changent de place
  alexShot: 'choix',        // 'choix' : Alex s'installe avec son plateau, le joueur trinque ou non · 'impose' : Alex fait boire Max
  alexDuration: 12,         // s d'effet
  alexMult: 2,              // multiplicateur de points pendant l'effet
  alexOfferTime: 5,         // s pour accepter (mode choix)
  alexSecondChance: 0.4,    // probabilité d'un second passage

  // Hugo — le coup de pression
  hugoOn: true,
  hugoDuration: 20,         // s de rush
  hugoTargetSimple: 13,     // boissons à servir, mode simple (calé au simulateur, marge pour un humain)
  hugoTargetTirage: 14,     // v1.25 (Jérémie) : Hugo demande 14 boissons (10 avant : 100 % des bons joueurs y arrivaient)
  // v1.25 : paliers de médaille, en part de la demande (14 → bronze 8, argent 11, or 14). Au simulateur, en tirage :
  // débutant 99 % bronze, 14 % argent ; bon joueur 100 % argent, 43 % or ; expert 99 % or.
  hugoBronzeAt: 0.6,
  hugoArgentAt: 0.8,
  hugoInterval: 0.85,       // s entre deux arrivées pendant le rush (fixe : ne dépend plus de la montée de la partie)
  hugoPatienceMult: 0.8,    // patience ×0,8 pendant le rush
  hugoErrorMult: 3,         // une erreur coûte 3 fois plus
  hugoBronze: 400,          // bonus par palier atteint
  hugoArgent: 800,
  hugoOr: 1200,
  hugoZeroFaute: 800,       // en plus de l'or, sans erreur ni client parti : 2 000 au plus, comme avant
  hugoBreath: 4,            // s sans arrivée après le rush

  // Jérémie — le contrôle qualité (v1.26, idée de Jérémie) : le brasseur s'installe au comptoir et goûte une IPA.
  // Parfaite : tampon « Approuvé », les clients suivants rapportent double. Ratée : il la vide à l'évier, on ressert.
  // Ce n'est jamais une pénalité de points : on perd seulement du temps. Au second passage (pompette), il valide tout.
  jeremieOn: true,          // en public, seulement quand ses dessins sont dans la page ; en test, silhouette provisoire
  jeremiePatience: 11,      // s pour lui servir son IPA
  jeremieTries: 2,          // pintes goûtées au plus par passage
  jeremieBoost: 4,          // clients suivants servis avec le bonus (v1.36 : 4 au lieu de 3, pour équilibrer avec le menu Alex)
  jeremieMult: 2,           // multiplicateur de ces clients
  jeremieShotBonus: 300,    // v1.37 (idée de Jérémie) : pompette, un shot servi rapporte en plus ces points (≈ un client)
  // v1.29 (Jérémie : le brasseur doit être plus exigeant que les clients) : sa zone dorée, plus étroite que la zone rose
  // (82-104 %), affichée sur la jauge quand il attend. Une pinte dans la zone dorée reste « parfaite » pour les clients.
  jeremieLo: 0.87,
  jeremieHi: 0.98,
  // Dosage des événements (v1.26, demande de Jérémie : sur 2 minutes, pas les trois à chaque fois).
  // Hugo à chaque partie ; le menu décide d'Alex et de Jérémie, tiré au hasard à chaque partie (classée ou non, v1.27).
  menu: 'hasard',           // 'hasard' (v1.28 : Alex ou Jérémie, une chance sur deux) · 'alex' (Alex + Hugo) · 'jeremie' (Jérémie deux fois + Hugo) · 'tous' (test seulement : Jérémie, Alex, Hugo)

  // Scènes d'Alex et Hugo
  explain: true,            // la première fois, la scène attend un toucher pour laisser lire la règle
  cutAlex: 3.2,             // s, scène du shot les fois suivantes
  cutHugo: 2.8,             // s, entrée d'Hugo les fois suivantes

  // Score
  pointsServe: 100,
  pointsSpeedMax: 50,
  pointsPerfect: 30,
  pointsDouble: 50,
  penaltyWrong: 50,
  penaltyLeft: 100,
  bonusEmptyBar: 300,

  // Confort et test
  sway: true,               // tangage pendant l'effet d'Alex
  sound: true,
  haptics: true,
  showZones: false,         // affiche les zones tactiles
  testButtons: false,       // boutons A / H en jeu pour déclencher Alex et Hugo
  slowmo: 1,                // vitesse du jeu (0,5 = ralenti)
  seed: 0,                  // 0 = aléatoire ; autre = même partie à chaque fois
};

// v1.31 (Jérémie) : une erreur ou un client parti fait perdre un palier au lieu de tout : ×3 → ×2 (combo 10), ×2 → ×1,5 (5), ×1,5 → ×1 (0).
// Avant, une erreur en fin de partie coûtait ≈ 2 400 points à un bon joueur ; maintenant ≈ 1 500.
function comboDrop(c) { return c >= 20 ? 10 : c >= 10 ? 5 : 0; }
function comboMult(c) { return c >= 20 ? 3 : c >= 10 ? 2 : c >= 5 ? 1.5 : 1; }
function nextComboStep(c) { return c >= 20 ? null : c >= 10 ? 20 : c >= 5 ? 10 : 5; }

// ─────────────────────────────────────────────────────────────
// CORE — logique pure et déterministe. Ne dessine rien, ne joue aucun son.
// Elle émet des événements (this.events) que le rendu, l'audio et Max écoutent.
// Le même code fait tourner le jeu, le simulateur et, plus tard, la vérification des scores.
// ─────────────────────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;
// v1.30 : pas de jeu fixe, le même pour le jeu, le simulateur et la vérification des scores par le Worker.
const GAME_STEP = 1 / 60;
const CUT_ALEX = 1.8;   // s, scène du shot (jeu figé)
const CUT_HUGO = 1.4;   // s, entrée d'Hugo (jeu figé)
const ALEX_TELEGRAPH = 1.1;
const CUT_JEREMIE = 2.6;   // s, carton du contrôle qualité (jeu figé)
const JER_TASTE = 1.15;    // s, Jérémie goûte : pause dramatique avant le verdict
const LOOKS = 16; // Huit visuels de clients, deux indices chacun (Anaïs : 8 et 9, Nico : 10 et 11, Roxane : 12 et 13, Jeremy : 14 et 15).
// Personne affichée par un indice : les clients de base 0-7 n'ont que quatre visages (indice % 4), chaque ami en a deux indices.
function lookPerson(look) { return look < 8 ? look % 4 : 4 + ((look - 8) >> 1); }
// Table de potes : l'ami en retrait, dessiné par render.js (choisi à l'arrivée dans `mate` ; ceci reste le repli).
function companionLook(look) { return (look + 3) % LOOKS; }
function mateOf(s) { return s.mate !== undefined ? s.mate : companionLook(s.look); }

class Game {
  // opts.noJeremie : Jérémie absent (en public tant que ses dessins ne sont pas dans la page) ; opts.menu : menu imposé (classé : celui de la semaine)
  constructor(cfg, seed, opts) {
    this.cfg = cfg;
    this.seed = seed >>> 0;
    this.opts = opts || {};
    // v1.30 (anti-triche) : journal des gestes. Chaque action du joueur est notée avec le numéro du pas de jeu
    // où elle a lieu ; le Worker rejoue la partie avec ce même code (replayGame) et recalcule le score.
    this.n = 0;                      // pas de jeu déjà joués
    this.log = [];                   // [pas, code, argument?] ; null pendant un rejeu
    this.rnd = mulberry32(this.seed || 1);
    this.t = 0;
    this.over = false;
    this.freeze = 0;
    this.cut = null;
    this.events = [];
    this.seats = [null, null, null, null];
    this.seatFreeAt = [0, 0, 0, 0];
    this.layout = LAYOUT_NORMAL.slice();
    this.prevLayout = LAYOUT_NORMAL.slice();
    this.swapPending = false;
    this.swapT = 9;                  // temps écoulé depuis le dernier échange (animation)
    this.tray = [];                  // plateau de Max : [{ drink, q, fill, at }], jusqu'à cfg.trayMax verres ; q : 'ok' | 'perfect' | 'low' (IPA trop vide)
    this.pours = 0;                  // v1.34 : numéro du dernier verre tiré ou complété (at d'un verre du plateau)
    this.hold = false;               // scène figée jusqu'à un toucher (explication au premier passage)
    this.learnPause = false;         // apprentissage : chrono, clients et arrivées suspendus ; seules les tireuses tournent
    this.st = { ipa: { pulling: false, fill: 0, topUp: null }, stout: { phase: 'idle', t: 0 } };
    this.pressing = false;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.nextId = 1;
    this.spawned = 0;
    this.forced = ['ipa', 'spritz', 'stout'];
    this.nextSpawn = 1.0;
    this.firstGate = true;           // personne d'autre avant que le premier client soit servi (9 s max)
    this.guide = false;              // premier service guidé : le premier client reste seul jusqu'à son départ (24 s max)
    this.breathUntil = 0;
    this.lastCall = false;
    this.lvl = 0;                    // palier de difficulté atteint (0 = premier)
    this.lastTick = -1;
    this.stats = {
      served: 0, drinks: 0, perfect: 0, ok: 0, low: 0, refused: 0, topUps: 0, errors: 0, left: 0, overflow: 0, learnPause: 0,
      discards: 0, alexPasses: 0, alexAccepted: 0, alexIgnored: 0, alexErrors: 0, alexDrinks: 0,
      hugoServed: 0, hugoTarget: 0, hugoTier: 0, hugoReached: false, hugoPerfect: false, hugoPlayed: false,
      emptyBonus: false, pullCancel: 0,
      jeremieVisits: 0, jeremieApproved: 0, jeremieRejected: 0, jeremieBoosted: 0, jeremieStale: 0, jeremieOdd: 0, jeremieVerdicts: [],
    };
    const k = cfg.duration / 120;
    this.k = k;
    this.alex = {
      state: 'off', pass: 0, tt: 0, effectEnd: 0, warned: false, seat: -1,
      at: cfg.alexOn ? this.range(38 * k, 55 * k) : Infinity,
      at2: (cfg.alexOn && this.rnd() < cfg.alexSecondChance) ? this.range(92 * k, 105 * k) : Infinity,
    };
    this.hugo = {
      state: 'off', end: 0, served: 0, errors: 0, left: 0,
      at: cfg.hugoOn ? this.range(62 * k, 72 * k) : Infinity,
      target: cfg.prep === 'simple' ? cfg.hugoTargetSimple : cfg.hugoTargetTirage,
    };
    // v1.25 : paliers bronze, argent, or (l'or = la demande d'Hugo)
    const T = this.hugo.target;
    this.hugo.tiers = [Math.round(T * cfg.hugoBronzeAt), Math.round(T * cfg.hugoArgentAt), T];
    // v1.26 : Jérémie, le contrôle qualité, et le menu d'événements (Hugo à chaque partie ; Alex et Jérémie selon le menu).
    // Suite aléatoire à part, tirée de la même graine : la suite des clients ne bouge pas, le menu change à chaque partie.
    this.jer = { state: 'off', visit: 0, at: [], boost: 0, seat: -1, waitUntil: 0 };
    this.menu = 'alex';
    if (cfg.jeremieOn && !(opts && opts.noJeremie)) {
      const r = mulberry32(((this.seed || 1) ^ 0x9E3779B9) >>> 0);
      // v1.28 (Jérémie : pas trois événements différents en deux minutes) : le hasard tire Alex ou Jérémie, jamais les deux ;
      // « tous » reste disponible dans le panneau de test.
      const MENUS = ['alex', 'jeremie', 'tous'], TIRAGE = ['alex', 'jeremie'];
      const m = MENUS.includes(cfg.menu) ? cfg.menu : (opts && MENUS.includes(opts.menu)) ? opts.menu : TIRAGE[Math.floor(r() * TIRAGE.length)];
      const R = (a, b) => (a + (b - a) * r()) * k;
      this.menu = m;
      if (m === 'jeremie') { this.alex.at = this.alex.at2 = Infinity; this.jer.at = [R(38, 50), R(94, 100)]; }   // deux passages, le second pompette
      else if (m === 'tous') { this.alex.at2 = Infinity; this.jer.at = [R(20, 27)]; }                          // un passage tôt, avant Alex
    }
  }

  range(a, b) { return a + (b - a) * this.rnd(); }
  clock() { return this.t + this.stats.learnPause; }   // temps écoulé, pauses d'apprentissage comprises
  emit(type, data) { this.events.push(Object.assign({ type, t: this.t }, data || {})); }

  // ── Difficulté par paliers (v1.6) ──
  // Un cran de plus toutes les stepEvery s (mises à l'échelle de la durée) : cadence, patience, places, doubles.
  level() { return Math.min(PALIERS.length - 1, Math.floor(this.t / Math.max(1, (this.cfg.stepEvery || 20) * this.k))); }
  pace() { return PALIERS[this.level()]; }
  interval() { return this.pace().iv / this.cfg.difficulty; }
  patienceBase() { return this.pace().pat * this.cfg.patienceMult; }
  maxSimul() { return this.pace().max; }
  doubleProb() { return this.pace().dbl; }
  pickDrink() {
    const r = this.rnd();
    return r < 0.35 ? 'ipa' : r < 0.6 ? 'spritz' : r < 0.8 ? 'stout' : 'shot';
  }
  gesture(d) {
    if (this.cfg.prep === 'simple') return 'tap';
    return d === 'ipa' ? 'hold' : d === 'stout' ? 'rest' : 'tap';
  }
  alexActive() { return this.alex.state === 'effect'; }
  inverted() { return this.alexActive() && this.cfg.alexMode === 'inversion'; }
  need(d) { return this.inverted() ? INV[d] : d; }
  rush() { return this.hugo.state === 'rush'; }
  eventBusy() {
    const a = this.alex.state, h = this.hugo.state, j = this.jer.state;
    return (a !== 'off' && a !== 'done') || h === 'intro' || h === 'rush' || j === 'waitSeat' || j === 'seat';
  }
  addScore(d) { this.score = Math.max(0, this.score + d); }

  // ── Boucle ──
  step(dt) {
    if (this.over) return;
    this.n++;
    if (this.freeze > 0) {
      if (this.cut) this.cut.t += dt;
      if (!this.hold) this.freeze -= dt;
      if (this.freeze <= 0) {
        const kind = this.cut ? this.cut.kind : null;
        this.freeze = 0; this.cut = null;
        this.onCutEnd(kind);
      }
      return;
    }
    if (this.learnPause) { this.stepLearning(dt); return; }
    this.t += dt;
    this.swapT += dt;
    this.updateStations(dt);
    this.updateCustomers(dt);
    this.updateAlex();
    this.updateHugo();
    this.updateJeremie();
    this.updateSpawner();
    const c = this.cfg;
    const lv = this.level();
    if (lv > this.lvl) { this.lvl = lv; this.emit('pace', { level: lv, doubles: c.doubles && PALIERS[lv].dbl > 0 && !(PALIERS[lv - 1].dbl > 0) }); }
    if (!this.lastCall && this.t >= c.duration - 10) { this.lastCall = true; this.emit('lastCall'); }
    if (this.t >= c.duration) this.finish();
  }

  // Pendant une consigne d'apprentissage : le chrono ne tourne pas, la patience ne baisse pas, personne n'arrive.
  // Les tireuses continuent (l'IPA se remplit, la stout repose) et les animations des clients se terminent.
  stepLearning(dt) {
    this.stats.learnPause += dt;
    this.swapT += dt;
    this.updateStations(dt);
    for (let i = 0; i < 4; i++) {
      const s = this.seats[i];
      if (!s) continue;
      if (s.wrongT > 0) s.wrongT -= dt;
      if (s.complainT > 0) s.complainT -= dt;
      if (s.isAlex || s.isJer || s.phase === 'wait') continue;
      s.pt += dt;
      if (s.phase === 'arrive' && s.pt >= 0.35) { s.phase = 'wait'; s.pt = 0; }
      else if ((s.phase === 'happy' && s.pt >= 0.45) || (s.phase === 'angry' && s.pt >= 0.6)) { s.phase = 'leave'; s.pt = 0; }
      else if (s.phase === 'leave' && s.pt >= 0.35) {
        this.seats[i] = null;
        this.seatFreeAt[i] = this.t + 0.7;
        if (this.firstGate && s.id === 1) { this.firstGate = false; this.nextSpawn = Math.min(this.nextSpawn, this.t + 0.6); }
      }
    }
  }

  finish() {
    this.over = true;
    const busy = this.seats.some((s) => s && !s.isAlex && !s.isJer && (s.phase === 'wait' || s.phase === 'arrive'));
    if (!busy) { this.addScore(this.cfg.bonusEmptyBar); this.stats.emptyBonus = true; }
    this.emit('over', { score: this.score });
  }

  // ── Stations ──
  updateStations(dt) {
    const c = this.cfg, ipa = this.st.ipa, so = this.st.stout;
    if (ipa.pulling) {
      ipa.fill += dt / c.pullFull;
      if (ipa.fill >= c.overflowAt) {
        const gl = ipa.topUp;
        ipa.pulling = false; ipa.fill = 0; ipa.topUp = null;
        if (gl) { const k = this.tray.indexOf(gl); if (k >= 0) this.tray.splice(k, 1); } // le verre qu'on complétait déborde aussi
        this.stats.overflow++;
        this.emit('overflow', { topUp: !!gl });
      }
    }
    if (so.phase === 'pour') { so.t += dt; if (so.t >= c.stoutPour) { so.phase = 'rest'; so.t = 0; } }
    else if (so.phase === 'rest') { so.t += dt; if (so.t >= c.stoutRest) { so.phase = 'ready'; so.t = 0; this.emit('stoutReady'); } }
  }

  // Le joueur appuie sur la station en position pos. Renvoie ce qui s'est passé.
  // ── Journal des gestes (v1.30) ──
  // Codes : p toucher une station · r relâcher l'IPA · s servir · d jeter un verre · P doigt posé/levé (tireuses à l'envers)
  // · h toucher pour continuer · W scène qui attend un toucher · L pause d'apprentissage · A J H événements forcés (test).
  rec(code, a) { if (this.log) this.log.push(a === undefined ? [this.n, code] : [this.n, code, a]); }
  setLearnPause(b) { b = !!b; if (b !== this.learnPause) { this.learnPause = b; this.rec('L', b ? 1 : 0); } }
  waitTap() { this.hold = true; this.rec('W'); }   // explication au premier passage : la scène attend un toucher

  press(pos) {
    this.rec('p', pos);
    if (this.freeze > 0 || this.over) return 'none';
    const d = this.layout[pos];
    const g = this.gesture(d);
    const full = this.trayFull();
    if (g === 'tap') {
      if (full) { this.emit('trayFull', { drink: d, pos }); return 'full'; }
      this.take(d, 'ok'); return 'pick';
    }
    if (g === 'hold') {
      // une IPA trop vide attend sur le plateau : on la remet sous la tireuse pour la compléter
      const low = this.tray.find((gl) => gl.drink === 'ipa' && gl.q === 'low');
      if (full && !low) { this.emit('trayFull', { drink: d, pos }); return 'full'; }
      const s = this.st.ipa;
      s.pulling = true; s.fill = low ? low.fill : 0; s.topUp = low || null;
      this.emit('pullStart', { pos, topUp: !!low, slot: low ? this.tray.indexOf(low) : -1 });
      return 'pull';
    }
    const s = this.st.stout;
    if (s.phase === 'idle') { s.phase = 'pour'; s.t = 0; this.emit('stoutLaunch', { pos }); return 'launch'; }
    if (s.phase === 'ready') {
      if (full) { this.emit('trayFull', { drink: d, pos }); return 'full'; }
      s.phase = 'idle'; this.take('stout', 'ok'); return 'pick';
    }
    this.emit('stoutBusy', { pos });
    return 'none';
  }

  // Qualité d'une IPA selon son remplissage réel.
  pintQuality(f) {
    const c = this.cfg;
    return f < c.goodLo ? 'low' : (f >= c.perfectLo && f <= c.perfectHi) ? 'perfect' : 'ok';
  }

  // Fin du maintien sur l'IPA (relâché ou doigt sorti de la station).
  // Le verre garde son remplissage réel : trop vide, il va quand même sur le plateau, mais le client le refusera.
  releasePull() {
    this.rec('r');
    const s = this.st.ipa;
    if (!s.pulling) return null;
    const f = s.fill, gl = s.topUp;
    s.pulling = false; s.fill = 0; s.topUp = null;
    const q = this.pintQuality(f);
    if (gl) { // verre complété : il reprend sa place sur le plateau
      const slot = this.tray.indexOf(gl);
      if (slot < 0) return null;
      gl.fill = f; gl.q = q; gl.at = ++this.pours;   // complété : tiré maintenant
      this.stats.topUps++;
      if (q === 'low') this.stats.low++;
      this.emit('pick', { drink: 'ipa', q, fill: f, slot, topUp: true });
      return q;
    }
    if (f < 0.15) { this.stats.pullCancel++; this.emit('pullCancel'); return null; }
    if (q === 'low') this.stats.low++;
    this.take('ipa', q, f);
    return q;
  }

  // ── Plateau ──
  trayMax() { return Math.max(1, this.cfg.trayMax || 1); }
  trayFull() { return this.trayMax() > 1 && this.tray.length >= this.trayMax(); }
  take(d, q, fill) {
    if (this.tray.length >= this.trayMax()) {
      if (this.trayMax() > 1) { this.emit('trayFull', { drink: d }); return false; }
      const old = this.tray.shift();       // plateau d'un seul verre : le nouveau remplace l'ancien
      this.stats.discards++; this.emit('discard', { drink: old.drink, slot: 0 });
    }
    this.tray.push({ drink: d, q, fill: fill === undefined ? 1 : fill, at: ++this.pours });
    this.emit('pick', { drink: d, q, fill, slot: this.tray.length - 1 });
    return true;
  }
  discardSlot(i) {
    this.rec('d', i);
    if (this.freeze > 0 || this.over || i < 0 || i >= this.tray.length) return false;
    if (this.st.ipa.topUp === this.tray[i]) return false;   // le verre est sous la tireuse
    const gl = this.tray.splice(i, 1)[0];
    this.stats.discards++;
    this.emit('discard', { drink: gl.drink, slot: i });
    return true;
  }
  releaseHold() {
    this.rec('h');
    if (!this.hold) return false;
    this.hold = false;
    this.freeze = Math.min(this.freeze, 0.3);
    return true;
  }

  setPressing(b) {
    if (!!b !== !!this.pressing) this.rec('P', b ? 1 : 0);
    this.pressing = b;
    if (!b && this.swapPending) this.doSwap();
  }

  requestSwap() { if (this.pressing) this.swapPending = true; else this.doSwap(); }
  doSwap() {
    this.swapPending = false;
    const target = (this.alexActive() && this.cfg.alexMode === 'miroir') ? LAYOUT_MIRROR : LAYOUT_NORMAL;
    if (target.join() === this.layout.join()) return;
    this.prevLayout = this.layout.slice();
    this.layout = target.slice();
    this.swapT = 0;
    this.emit('swap');
  }

  // ── Clients ──
  // v1.17 : jamais deux fois la même personne au comptoir (deux Nico en même temps, c'était bizarre).
  // Un seul tirage au hasard comme avant, parmi les visages encore libres ; l'ami d'une table de potes compte aussi
  // et il est choisi lui aussi parmi les visages libres (4 places, 8 visages : il en reste toujours deux).
  pickLook(dbl) {
    const used = new Set();
    for (const s of this.seats) {
      if (!s || s.isAlex || s.isJer) continue;
      used.add(lookPerson(s.look));
      if (s.dbl) used.add(lookPerson(mateOf(s)));
    }
    const free = [];
    for (let l = 0; l < LOOKS; l++) if (!used.has(lookPerson(l))) free.push(l);
    const r = this.rnd();
    if (!free.length) { const l = Math.floor(r * LOOKS); return { look: l, mate: companionLook(l) }; }
    const look = free[Math.floor(r * free.length)];
    if (!dbl) return { look };
    const mates = free.filter((m) => lookPerson(m) !== lookPerson(look));
    const r2 = (r * 7919) % 1;   // second choix tiré du même nombre : la suite aléatoire de la partie ne change pas
    return { look, mate: mates.length ? mates[Math.floor(r2 * mates.length)] : companionLook(look) };
  }
  spawnCustomer(seat) {
    const c = this.cfg;
    let drinks;
    if (this.forced.length) drinks = [this.forced.shift()];
    else {
      drinks = [this.pickDrink()];
      const pd = (c.doubles && !this.rush()) ? this.doubleProb() : 0;
      if (this.rnd() < pd) drinks.push(this.pickDrink());
    }
    const dbl = drinks.length > 1;
    let type = 'normal';
    if (!dbl && this.spawned >= 3) {
      const r = this.rnd();
      type = r < 0.3 ? 'habitue' : r < 0.52 ? 'presse' : 'normal';
    }
    let pmax = this.patienceBase() * (type === 'habitue' ? 1.3 : type === 'presse' ? 0.6 : 1) * (dbl ? 1.5 : 1);
    if (this.rush()) pmax *= c.hugoPatienceMult;
    const tuto = this.spawned < 3;
    if (tuto) pmax = Math.max(pmax, 22);
    const cust = {
      id: this.nextId++, seat, ...this.pickLook(dbl), type, dbl,
      orders: drinks.map((d) => ({ drink: d, done: false })),
      patience: pmax, pmax, phase: 'arrive', pt: 0, born: this.t,
      tuto: tuto && c.hints, wrongT: 0, isAlex: false,
    };
    this.seats[seat] = cust;
    this.spawned++;
    this.emit('spawn', { seat, id: cust.id });
  }

  updateCustomers(dt) {
    for (let i = 0; i < 4; i++) {
      const s = this.seats[i];
      if (!s) continue;
      s.pt += dt;
      if (s.wrongT > 0) s.wrongT -= dt;
      if (s.complainT > 0) s.complainT -= dt;
      if (s.isAlex) { this.updateAlexSeat(s, i); continue; }
      if (s.isJer) { this.updateJerSeat(s, i, dt); continue; }
      switch (s.phase) {
        case 'arrive': if (s.pt >= 0.35) { s.phase = 'wait'; s.pt = 0; } break;
        case 'wait':
          s.patience -= dt;
          if (s.patience <= 0) this.customerLeft(s);
          break;
        case 'happy': if (s.pt >= 0.45) { s.phase = 'leave'; s.pt = 0; } break;
        case 'angry': if (s.pt >= 0.6) { s.phase = 'leave'; s.pt = 0; } break;
        case 'leave':
          if (s.pt >= 0.35) {
            this.seats[i] = null;
            this.seatFreeAt[i] = this.t + (this.rush() ? 0.3 : 0.7);
            if (this.firstGate && s.id === 1) { this.firstGate = false; this.nextSpawn = Math.min(this.nextSpawn, this.t + 0.6); }
          }
          break;
      }
    }
  }

  customerLeft(s) {
    s.phase = 'angry'; s.pt = 0; s.patience = 0;
    this.combo = comboDrop(this.combo);   // v1.31 : un palier de moins, pas tout
    this.addScore(-this.cfg.penaltyLeft);
    this.stats.left++;
    if (this.rush()) this.hugo.left++;
    this.emit('left', { seat: s.seat, pen: this.cfg.penaltyLeft });
  }

  // Le joueur sert le plateau au client de la place seat : le client prend ce qu'il a commandé, le reste reste sur le plateau.
  serve(seat) {
    this.rec('s', seat);
    if (this.freeze > 0 || this.over) return 'none';
    const s = this.seats[seat];
    if (!s) return 'none';
    if (s.isAlex) {
      if (s.phase === 'offer') { this.acceptAlex(s); return 'alex'; }
      return 'none';
    }
    if (s.isJer) return this.serveJeremie(s);
    if (s.phase !== 'wait' && s.phase !== 'arrive') return 'none';
    if (!this.tray.length) { this.emit('noGlass', { seat }); return 'noGlass'; }
    const c = this.cfg;
    const taken = [];
    const under = this.st.ipa.topUp;      // verre en train d'être complété : pas servable
    let tooLow = false;
    for (const o of s.orders) {
      if (o.done) continue;
      const want = this.need(o.drink);
      const k = this.tray.findIndex((gl, j) => gl.drink === want && gl.q !== 'low' && gl !== under && !taken.some((x) => x.k === j));
      if (k >= 0) taken.push({ k, o, gl: this.tray[k] });
      else if (this.tray.some((gl) => gl.drink === want && (gl.q === 'low' || gl === under))) tooLow = true;
    }
    // IPA trop vide : le client la refuse, le verre reste sur le plateau (pas de pénalité, mais du temps perdu)
    if (tooLow) { s.complainT = 1.8; this.stats.refused++; }
    if (!taken.length && tooLow) { this.emit('tooLow', { seat }); return 'tooLow'; }
    if (!taken.length) {
      const pen = this.rush() ? c.penaltyWrong * c.hugoErrorMult : c.penaltyWrong;
      this.combo = comboDrop(this.combo);   // v1.31 : un palier de moins, pas tout
      this.addScore(-pen);
      s.patience = Math.max(s.patience - 0.25 * s.pmax, Math.min(s.patience, 1));
      s.wrongT = 0.6;
      this.stats.errors++;
      if (this.alexActive()) this.stats.alexErrors++;
      if (this.rush()) this.hugo.errors++;
      this.emit('wrong', { seat, pen });
      return 'wrong';
    }
    const prevMult = comboMult(this.combo);
    // v1.26 : pinte approuvée par Jérémie → les clients suivants rapportent ×jeremieMult (sans s'ajouter à Alex)
    const boost = this.jer.boost > 0;
    const ev = Math.max(this.alexActive() ? c.alexMult : 1, boost ? c.jeremieMult : 1);
    let total = 0, perfects = 0;
    for (const x of taken) {
      x.o.done = true;
      this.combo++;
      const base = c.pointsServe * (s.type === 'presse' ? 1.5 : 1);
      const speed = Math.round(c.pointsSpeedMax * Math.max(0, s.patience) / s.pmax);
      let pts = Math.round((base + speed) * comboMult(this.combo) * ev);
      if (x.gl.q === 'perfect') { pts += c.pointsPerfect; perfects++; }
      total += pts;
      this.stats.drinks++;
      this.stats[x.gl.q]++;
      if (this.alexActive()) this.stats.alexDrinks++;
      if (this.rush()) this.hugo.served++;
    }
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const slots = taken.map((x) => x.k);
    this.tray = this.tray.filter((_, j) => !slots.includes(j));
    const complete = s.orders.every((o) => o.done);
    if (complete && s.orders.length > 1) total += c.pointsDouble;
    this.addScore(total);
    if (complete) { this.stats.served++; s.phase = 'happy'; s.pt = 0; }
    if (boost && complete) { this.jer.boost--; this.stats.jeremieBoosted++; }
    this.emit('serve', { seat, pts: total, n: taken.length, perfects, drinks: taken.map((x) => x.gl.drink), fills: taken.map((x) => x.gl.fill), slots, complete, combo: this.combo, mult: comboMult(this.combo), ev, boost: boost ? this.jer.boost : -1 });
    if (comboMult(this.combo) > prevMult) this.emit('comboLevel', { mult: comboMult(this.combo), combo: this.combo });
    if (tooLow) this.emit('tooLow', { seat, partial: true });
    return 'serve';
  }

  // ── Arrivées ──
  updateSpawner() {
    const c = this.cfg, t = this.t;
    if (t >= c.duration - 8) return;
    if (t < this.breathUntil) return;
    if (this.hugo.state === 'intro') return;
    if (this.firstGate && this.spawned >= 1) {
      if (t < (this.guide ? 24 : 9)) return;
      this.firstGate = false;
    }
    let occ = 0; for (let i = 0; i < 4; i++) if (this.seats[i]) occ++;   // sans tableau temporaire à chaque pas (v1.30)
    const rush = this.rush();
    const maxS = rush ? 4 : this.maxSimul();
    // On n'attend jamais à vide (retour d'Anaïs) : bar vide, le client suivant arrive tout de suite ;
    // un seul client au comptoir, le suivant ne tarde pas.
    if (this.spawned > 0 && !rush) {
      const cap = occ === 0 ? c.emptyGap : occ === 1 ? c.loneGap : Infinity;
      if (this.nextSpawn > t + cap) this.nextSpawn = t + cap;
    }
    if (t < this.nextSpawn || occ >= maxS) return;
    const free = [];
    for (let i = 0; i < 4; i++) if (!this.seats[i] && this.seatFreeAt[i] <= t) free.push(i);
    if (!free.length) return;
    const seat = free[Math.floor(this.rnd() * free.length)];
    this.spawnCustomer(seat);
    const iv = rush ? c.hugoInterval / c.difficulty : this.interval();
    this.nextSpawn = t + iv * (0.8 + 0.4 * this.rnd());
  }

  // ── Alex, le shot de trop ──
  updateAlex() {
    const a = this.alex, t = this.t, c = this.cfg;
    switch (a.state) {
      case 'off':
        if (t >= a.at && !this.eventBusy() && t < c.duration - 16) this.alexStart();
        break;
      case 'telegraph':
        a.tt -= 1 / 60;
        if (t >= a.cutAt) this.alexCut();
        break;
      case 'waitSeat': {
        if (this.hugo.state !== 'off' && this.hugo.state !== 'done') { a.state = 'done'; break; }
        if (t > a.waitUntil) { a.state = 'done'; break; }
        for (let i = 0; i < 4; i++) {
          if (!this.seats[i] && this.seatFreeAt[i] <= t) {
            this.seats[i] = { id: this.nextId++, seat: i, isAlex: true, phase: 'arrive', pt: 0, offerEnd: t + 0.35 + c.alexOfferTime, wrongT: 0, orders: [] };
            a.seat = i; a.state = 'offer';
            this.emit('alexOffer', { seat: i });
            break;
          }
        }
        break;
      }
      case 'effect':
        if (!a.warned && t >= a.effectEnd - 2) { a.warned = true; this.emit('alexEnding'); }
        if (t >= a.effectEnd) this.alexEndEffect();
        break;
      case 'done':
        if (a.pass === 1 && t >= a.at2 && !this.eventBusy() && t < c.duration - 16) this.alexStart();
        break;
    }
  }

  updateAlexSeat(s, i) {
    const a = this.alex;
    switch (s.phase) {
      case 'arrive': if (s.pt >= 0.35) { s.phase = 'offer'; s.pt = 0; } break;
      case 'offer':
        if (this.t >= s.offerEnd) {
          s.phase = 'vexed'; s.pt = 0;
          a.state = 'done';
          this.stats.alexIgnored++;
          this.emit('alexIgnored', { seat: i });
        }
        break;
      case 'cheers': if (s.pt >= 0.3) { s.phase = 'leave'; s.pt = 0; } break;
      case 'vexed': if (s.pt >= 0.6) { s.phase = 'leave'; s.pt = 0; } break;
      case 'leave': if (s.pt >= 0.35) { this.seats[i] = null; this.seatFreeAt[i] = this.t + 0.5; } break;
    }
  }

  alexStart() {
    const a = this.alex;
    a.pass++;
    this.stats.alexPasses++;
    if (this.cfg.alexShot === 'impose') {
      a.state = 'telegraph';
      a.cutAt = this.t + ALEX_TELEGRAPH;
      this.emit('alexTelegraph');
    } else {
      a.state = 'waitSeat';
      a.waitUntil = this.t + 6;
    }
  }

  acceptAlex(s) {
    s.phase = 'cheers'; s.pt = 0;
    this.stats.alexAccepted++;
    this.alexCut();
  }

  alexCut() {
    this.alex.state = 'drinking';
    const d = this.cfg.cutAlex || CUT_ALEX;
    this.freeze = d;
    this.cut = { kind: 'alex', t: 0, dur: d };
    this.emit('alexCut');
  }

  alexEndEffect() {
    this.alex.state = 'done';
    if (this.cfg.alexMode === 'miroir') this.requestSwap();
    this.emit('alexEnd');
  }

  // ── Hugo, le coup de pression ──
  updateHugo() {
    const h = this.hugo, t = this.t, c = this.cfg;
    if (h.state === 'off') {
      const alexFree = this.alex.state === 'off' || this.alex.state === 'done' || this.alex.state === 'waitSeat';
      const jerFree = this.jer.state === 'off' || this.jer.state === 'done';
      if (t >= h.at && alexFree && jerFree && t < c.duration - 26) {
        if (this.alex.state === 'waitSeat') this.alex.state = 'done';
        h.state = 'intro';
        const d = c.cutHugo || CUT_HUGO;
        this.freeze = d;
        this.cut = { kind: 'hugo', t: 0, dur: d };
        this.stats.hugoPlayed = true;
        this.stats.hugoTarget = h.target;
        this.emit('hugoCut', { target: h.target });
      }
    } else if (h.state === 'rush') {
      const left = Math.ceil(h.end - t);
      if (left !== this.lastTick && left >= 0) { this.lastTick = left; this.emit('tick', { left }); }
      if (t >= h.end) {
        h.state = 'done';
        const tier = this.hugoTier();                     // 0 rien · 1 bronze · 2 argent · 3 or
        const reached = tier === 3;
        const perfect = reached && h.errors === 0 && h.left === 0;
        const bonus = [0, c.hugoBronze, c.hugoArgent, c.hugoOr][tier] + (perfect ? c.hugoZeroFaute : 0);
        this.addScore(bonus);
        this.stats.hugoServed = h.served;
        this.stats.hugoTier = tier;
        this.stats.hugoReached = reached;
        this.stats.hugoPerfect = perfect;
        this.breathUntil = t + c.hugoBreath;
        this.emit('hugoEnd', { reached, perfect, bonus, tier, served: h.served, target: h.target, tiers: h.tiers });
      }
    }
  }

  // Palier atteint pendant le rush d'Hugo : 0 rien · 1 bronze · 2 argent · 3 or.
  hugoTier() { const h = this.hugo, n = h.served; return n >= h.tiers[2] ? 3 : n >= h.tiers[1] ? 2 : n >= h.tiers[0] ? 1 : 0; }

  onCutEnd(kind) {
    const c = this.cfg;
    if (kind === 'alex') {
      const a = this.alex;
      a.state = 'effect';
      a.effectEnd = this.t + c.alexDuration;
      a.warned = false;
      if (c.alexMode === 'miroir') this.requestSwap();
      this.emit('alexEffect', { mode: c.alexMode });
    } else if (kind === 'hugo') {
      const h = this.hugo;
      h.state = 'rush';
      h.end = this.t + c.hugoDuration;
      h.served = 0; h.errors = 0; h.left = 0;
      this.lastTick = -1;
      this.nextSpawn = this.t + 0.2;
      for (let i = 0; i < 4; i++) this.seatFreeAt[i] = Math.min(this.seatFreeAt[i], this.t + 0.2);
      this.emit('hugoStart', { target: h.target });
    } else if (kind === 'jeremie') this.emit('jeremieGo', { seat: this.jer.seat });
  }

  // ── Jérémie, le contrôle qualité (v1.26) ──
  // Il s'installe au comptoir et commande une IPA. Il la goûte (pause dramatique), puis :
  // parfaite → tampon « Approuvé », les jeremieBoost clients suivants rapportent ×jeremieMult ;
  // pas parfaite → il la vide à l'évier et en redemande une (jeremieTries au plus) ; trop vide → refusée comme un client.
  // Jamais de points en moins : on perd seulement du temps. Au second passage, pompette, il valide toute pinte acceptée.
  // Zone dorée du brasseur (v1.29) : plus étroite que la zone rose des clients.
  brewOk(f) { return f >= this.cfg.jeremieLo && f <= this.cfg.jeremieHi; }
  // Jérémie (sobre) attend au comptoir : la jauge montre sa zone dorée.
  jerWants() {
    const j = this.jer, s = j.state === 'seat' ? this.seats[j.seat] : null;
    return !!(s && s.isJer && !s.tipsy && (s.phase === 'wait' || s.phase === 'arrive'));
  }
  updateJeremie() {
    const j = this.jer, t = this.t, c = this.cfg;
    if (j.state === 'off') {
      const at = j.at[j.visit];
      if (at === undefined) { j.state = 'done'; return; }
      if (t >= at && !this.eventBusy() && t < c.duration - 20) { j.state = 'waitSeat'; j.waitUntil = t + 6; }
    }
    if (j.state === 'waitSeat') {
      if (t > j.waitUntil) { this.jerNext(); return; }   // le bar est plein : il repassera (ou pas)
      for (let i = 0; i < 4; i++) if (!this.seats[i] && this.seatFreeAt[i] <= t) { this.jerSit(i); break; }
    }
  }
  jerSit(i) {
    const c = this.cfg, j = this.jer, tipsy = j.visit > 0;
    const s = {
      id: this.nextId++, seat: i, isJer: true, isAlex: false, look: -1, type: 'normal', dbl: false, tipsy,
      orders: [{ drink: 'ipa', done: false }], patience: c.jeremiePatience, pmax: c.jeremiePatience,
      phase: 'arrive', pt: 0, born: this.t, tuto: false, wrongT: 0, tries: 0, tasted: null, since: this.pours,
    };
    this.seats[i] = s; j.seat = i; j.state = 'seat';
    this.stats.jeremieVisits++;
    this.emit('jeremieArrive', { seat: i, visit: j.visit, tipsy });
    if (j.visit === 0) { // premier passage de la partie : le carton (le jeu est figé, il s'installe ensuite)
      const d = c.cutJeremie || CUT_JEREMIE;
      this.freeze = d; this.cut = { kind: 'jeremie', t: 0, dur: d };
      this.emit('jeremieCut');
    }
  }
  updateJerSeat(s, i, dt) {
    const c = this.cfg;
    switch (s.phase) {
      case 'arrive': if (s.pt >= 0.35) { s.phase = 'wait'; s.pt = 0; } break;
      case 'wait':
        s.patience -= dt;
        if (s.patience <= 0) { s.patience = 0; s.phase = 'gone'; s.pt = 0; this.jerVerdict(s, 'parti'); }
        break;
      case 'taste': if (s.pt >= JER_TASTE) this.jerJudge(s); break;
      case 'approve': if (s.pt >= 1.5) { s.phase = 'leave'; s.pt = 0; } break;
      case 'reject':
        if (s.pt < 1.3) break;
        if (s.tries < c.jeremieTries) {
          s.phase = 'wait'; s.pt = 0; s.orders[0].done = false;
          s.patience = Math.max(s.patience, 5);
          this.emit('jeremieAgain', { seat: i });
        } else { s.phase = 'leave'; s.pt = 0; this.jerVerdict(s, 'revoir'); }
        break;
      case 'gone': if (s.pt >= 1.2) { s.phase = 'leave'; s.pt = 0; } break;
      case 'leave': if (s.pt >= 0.35) { this.seats[i] = null; this.seatFreeAt[i] = this.t + 0.5; this.jerNext(); } break;
    }
  }
  // Le joueur sert le plateau à Jérémie : il prend la meilleure IPA du plateau.
  // v1.34 (Jérémie : on contournait la zone dorée avec une pinte tirée d'avance) : sobre, il ne goûte qu'une pinte
  // tirée (ou complétée) après son arrivée au comptoir. Une pinte d'avant reste sur le plateau pour les clients,
  // sans pénalité. Pompette, il ne regarde plus d'où elle vient.
  // v1.35 (easter egg, idée de Jérémie) : pompette, il prend n'importe quel verre et le valide (une IPA s'il y en a une
  // de servable, sinon une stout, un spritz, un shot ou une IPA trop vide : « Une IPA… bien noire. J'adore. »).
  // v1.37 : un shot passe avant tout (« Roh bon allez, p'tit bonus pour toi ! ») et rapporte jeremieShotBonus en plus.
  jerFresh(s, gl) { return s.tipsy || gl.at > s.since; }
  serveJeremie(s) {
    if (s.phase !== 'wait' && s.phase !== 'arrive') return 'none';
    if (!this.tray.length) { this.emit('noGlass', { seat: s.seat }); return 'noGlass'; }
    // il prend la meilleure IPA du plateau : zone dorée, puis parfaite, puis acceptée
    const under = this.st.ipa.topUp;
    const rank = s.tipsy ? (gl) => (gl.drink === 'shot' ? 4 : gl.drink !== 'ipa' ? 2 : gl.q === 'low' ? 1 : 3)   // pompette : tout lui va, le shot d'abord
      : (gl) => (gl.drink !== 'ipa' || gl.q === 'low' ? 0 : this.brewOk(gl.fill) ? 3 : gl.q === 'perfect' ? 2 : 1);
    let k = -1;
    this.tray.forEach((gl, n) => { if (gl !== under && this.jerFresh(s, gl) && rank(gl) && (k < 0 || rank(gl) > rank(this.tray[k]))) k = n; });
    if (k < 0) {
      if (this.tray.some((gl) => gl.drink === 'ipa' && gl !== under && gl.q !== 'low')) { this.stats.jeremieStale++; this.emit('jeremieStale', { seat: s.seat }); return 'stale'; }
      if (this.tray.some((gl) => gl.drink === 'ipa')) { s.complainT = 1.8; this.stats.refused++; this.emit('tooLow', { seat: s.seat }); return 'tooLow'; }
      s.wrongT = 0.6; s.patience = Math.max(1, s.patience - 0.2 * s.pmax);   // pas de points en moins : du temps
      this.emit('jeremieWrong', { seat: s.seat });
      return 'wrong';
    }
    const gl = this.tray.splice(k, 1)[0];
    s.orders[0].done = true; s.tries++; s.tasted = gl.q; s.tastedFill = gl.fill; s.tastedDrink = gl.drink;
    s.phase = 'taste'; s.pt = 0;
    this.emit('jeremieTaste', { seat: s.seat, slot: k, q: gl.q, fill: gl.fill, drink: gl.drink, tipsy: s.tipsy });
    return 'jeremie';
  }
  jerJudge(s) {
    // en service simple, pas de tirage : toute IPA servie compte comme parfaite
    const c = this.cfg, ipa = s.tastedDrink === 'ipa';
    const perfect = ipa && s.tasted !== 'low' && (this.brewOk(s.tastedFill) || c.prep === 'simple');   // v1.29 : la zone dorée
    // v1.35 : pompette, il valide tout (avant : une pinte rose hors zone dorée lui était refusée par erreur)
    if (perfect || s.tipsy) {
      s.phase = 'approve'; s.pt = 0;
      this.jer.boost = c.jeremieBoost;
      this.stats.jeremieApproved++;
      const odd = s.tipsy && (!ipa || s.tasted === 'low');   // l'easter egg : autre chose qu'une IPA servable
      if (odd) this.stats.jeremieOdd++;
      const shot = s.tipsy && s.tastedDrink === 'shot' ? (c.jeremieShotBonus || 0) : 0;   // v1.37 : p'tit bonus
      if (shot) { this.score += shot; this.stats.jeremieShot = (this.stats.jeremieShot || 0) + shot; }
      this.jerVerdict(s, perfect ? 'approuve' : shot ? 'shot' : 'pompette');
      this.emit('jeremieApprove', { seat: s.seat, boost: c.jeremieBoost, tipsy: s.tipsy, perfect, drink: s.tastedDrink, odd, shot });
    } else {
      s.phase = 'reject'; s.pt = 0;
      this.stats.jeremieRejected++;
      this.emit('jeremieReject', { seat: s.seat, last: s.tries >= c.jeremieTries, tipsy: s.tipsy, over: s.tastedFill > c.jeremieHi });
    }
  }
  jerVerdict(s, v) { this.stats.jeremieVerdicts.push(v); this.emit('jeremieVerdict', { seat: s.seat, v, tipsy: s.tipsy }); }
  // Passage suivant : au moins 20 s plus tard, pour laisser respirer.
  jerNext() {
    const j = this.jer;
    j.visit++; j.seat = -1;
    if (j.visit < j.at.length) { j.at[j.visit] = Math.max(j.at[j.visit], this.t + 20); j.state = 'off'; }
    else j.state = 'done';
  }

  // Déclencheurs du mode test
  forceAlex() {
    this.rec('A');
    if (this.over || this.freeze > 0 || this.eventBusy()) return false;
    this.alex.pass = Math.max(this.alex.pass, 1) - 1; // n'empêche pas un second passage naturel
    this.alexStart();
    return true;
  }
  forceJeremie() {
    this.rec('J');
    if (this.over || this.freeze > 0 || this.eventBusy()) return false;
    const j = this.jer;
    j.at.splice(j.visit, 0, this.t); j.state = 'off';
    this.updateJeremie();
    return j.state === 'seat' || j.state === 'waitSeat';
  }
  forceHugo() {
    this.rec('H');
    if (this.over || this.freeze > 0 || this.eventBusy()) return false;
    if (this.hugo.state === 'done') this.hugo.state = 'off';
    this.hugo.at = this.t;
    this.updateHugo();
    return this.hugo.state === 'intro';
  }
}

// ── Rejeu d'une partie (v1.30, anti-triche) ──
// Mêmes réglages, même graine, mêmes gestes aux mêmes pas : la partie se rejoue à l'identique.
// rj = { guide, log } (le reste de l'en-tête est vérifié par le Worker). maxSteps : garde-fou contre un journal truqué.
const REPLAY_CODES = 'prsdPhWLAJH';
function replayGame(cfg, seed, opts, rj, maxSteps) {
  const g = new Game(cfg, seed, opts);
  g.log = null;
  g.guide = !!rj.guide;
  const log = rj.log || [], max = maxSteps || 216000;   // 1 h de jeu au plus
  let i = 0;
  const apply = (e) => {
    const a = e[2];
    switch (e[1]) {
      case 'p': g.press(a); break;
      case 'r': g.releasePull(); break;
      case 's': g.serve(a); break;
      case 'd': g.discardSlot(a); break;
      case 'P': g.setPressing(!!a); break;
      case 'h': g.releaseHold(); break;
      case 'W': g.hold = true; break;
      case 'L': g.learnPause = !!a; break;
      case 'A': g.forceAlex(); break;
      case 'J': g.forceJeremie(); break;
      case 'H': g.forceHugo(); break;
    }
  };
  while (!g.over && g.n < max) {
    while (i < log.length && log[i][0] <= g.n) apply(log[i++]);
    g.step(GAME_STEP);
    g.events.length = 0;
  }
  return g;
}

export { DEFAULTS, Game, replayGame, GAME_STEP, REPLAY_CODES };
