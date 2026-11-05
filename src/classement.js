// ─────────────────────────────────────────────────────────────
// CLASSEMENT — top de la semaine, servi par le Worker Cloudflare (/api/…, voir worker/index.js).
// Partie classée : réglages par défaut (le confort ne compte pas). v1.27 : chaque partie est tirée au hasard
// (clients et événements), comme une partie non classée. Sur le lien claude.ai ou sans réseau,
// le classement se cache simplement.
// Chargé avant main.js : ne rien exécuter au chargement, tout passe par Rank.init() (appelé par boot).
// ─────────────────────────────────────────────────────────────
const RANK_COMFORT = ['sound', 'haptics', 'sway', 'showZones', 'hints', 'explain'];   // v1.32 : plus de réglage « salle »
const RANK_NAME_KEY = 'ga1.rankName';
const RANK_SECRET_KEY = 'ga1.rankKey';   // v1.30 : clé du téléphone, qui réserve son nom au classement
// v1.18 : visuels du classement (ChatGPT, découpés par tools/pack-rank.py), 7 cases de 128 × 128 :
// 0 or · 1 argent · 2 bronze · 3 trophée (chope dorée) · 4 couronne à la craie · 5 laurier gauche · 6 laurier droit.
const RANK_ART = new Image(); RANK_ART.src = '__RANK_ICONS_DATA__';

// Semaine du lundi au dimanche, heure de Paris. cle = date du lundi (AAAA-MM-JJ). Même calcul que le Worker.
function semaineParis(ms) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
    .formatToParts(new Date(ms))) parts[p.type] = p.value;
  const jour = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
  const d = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day - jour));
  return { cle: d.toISOString().slice(0, 10) };
}
const rankKey = (nom) => String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const rankOrd = (n) => (n === 1 ? '1er' : n + 'e');
const rankFmt = (n) => Number(n).toLocaleString('fr-FR');

const Rank = {
  up: null,      // null : pas encore vérifié · true : le classement répond · false : indisponible
  data: null,    // dernier top de la semaine reçu { semaine, du, top, joueurs }
  dataAll: null, // dernier top de tous les temps { top, joueurs, depuis }
  tab: 'semaine',
  game: null,    // partie en cours { ranked, eligible, id, wait, failed }
  end: null,     // addition affichée { payload, game, sent }
  last: null,    // dernier résultat d'inscription (rang du joueur)
  back: 'sTitle',
  defi: null,    // défi reçu par lien (v1.24, posé par main.js) : la bulle de Max ne montre alors pas le n° 1
  el: {},

  get name() { try { return localStorage.getItem(RANK_NAME_KEY) || ''; } catch (e) { return ''; } },
  set name(v) { try { if (v) localStorage.setItem(RANK_NAME_KEY, v); else localStorage.removeItem(RANK_NAME_KEY); } catch (e) { /* stockage indisponible */ } },
  // v1.30 : clé secrète tirée une fois et gardée sur le téléphone. Le premier téléphone qui inscrit un nom le réserve :
  // personne d'autre ne peut ensuite jouer sous ce nom (le serveur ne garde qu'une empreinte de la clé).
  _secret: null,
  get secret() {
    if (this._secret) return this._secret;
    let k = null;
    try { k = localStorage.getItem(RANK_SECRET_KEY); } catch (e) { /* stockage indisponible */ }
    if (!/^[0-9a-f]{32}$/.test(k || '')) {
      const b = new Uint8Array(16);
      try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
      k = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(RANK_SECRET_KEY, k); } catch (e) { /* stockage indisponible : clé de la session */ }
    }
    return (this._secret = k);
  },

  // Seuls les réglages par défaut comptent (son, vibrations, guidage… ne changent pas la partie).
  eligible(c) { return Object.keys(DEFAULTS).every((k) => RANK_COMFORT.includes(k) || c[k] === DEFAULTS[k]); },

  async call(path, body) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch('/api/' + path, body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl && ctrl.signal }
        : { cache: 'no-store', signal: ctrl && ctrl.signal });
      if (!(r.headers.get('Content-Type') || '').includes('application/json')) throw Object.assign(new Error('indispo'), { code: 'indispo' });
      const j = await r.json();
      if (!r.ok) throw Object.assign(new Error(j.erreur || 'erreur'), { code: j.code || 'serveur', server: true });
      return j;
    } finally { if (timer) clearTimeout(timer); }
  },

  init() {
    const $r = (id) => document.getElementById(id);
    document.getElementById('app').style.setProperty('--img-rank', `url("${RANK_ART.src}")`);
    for (const id of ['bRank', 'tRankLead', 'sRank', 'kTitle', 'kTabWeek', 'kTabAll', 'kWeek', 'kList', 'kEmpty', 'kMine', 'eRank', 'eRankForm', 'eName', 'eRankGo', 'eRankMsg', 'eRankTop', 'eRankAll', 'eRankRename', 'eRankRetry', 'eRankReset']) this.el[id] = $r(id);
    const e = this.el;
    e.bRank.addEventListener('click', () => this.open('sTitle'));
    e.kTabWeek.addEventListener('click', () => this.show('semaine'));
    e.kTabAll.addEventListener('click', () => this.show('tout'));
    $r('bRankBack').addEventListener('click', () => this.close());
    e.eRankAll.addEventListener('click', () => this.open('sEnd'));
    e.eRankForm.addEventListener('submit', (ev) => { ev.preventDefault(); this.submit(e.eName.value); });
    e.eRankRename.addEventListener('click', () => { this.name = ''; this.showForm(''); e.eName.focus(); });
    e.eRankRetry.addEventListener('click', () => this.submit(this.name || e.eName.value));
    e.eRankReset.addEventListener('click', () => {
      const keep = {}; for (const k of RANK_COMFORT) keep[k] = settings[k];
      settings = Object.assign({}, DEFAULTS, keep); saveSettings();
      this.msg('Réglages par défaut remis : ta prochaine partie comptera.');
      e.eRankReset.hidden = true;
    });
    this.refresh();
  },

  async refresh() {
    try { this.data = await this.call('classement'); this.up = true; } catch (err) { this.up = false; }
    this.paintTitle();
    if (!this.el.sRank.hidden && this.tab === 'semaine') this.paintBoard();
  },
  async refreshAll() {
    try { this.dataAll = await this.call('classement?periode=tout'); } catch (err) { /* on garde le dernier reçu */ }
    if (!this.el.sRank.hidden && this.tab === 'tout') this.paintBoard();
  },

  // ── Accueil : bouton du classement, avec le n° 1 de la semaine ──
  paintTitle() {
    const e = this.el;
    e.bRank.hidden = !this.up;
    const lead = this.data && this.data.top && this.data.top[0];
    // Max annonce le score à battre dans sa bulle (pas de ligne en plus sur l'accueil)
    e.tRankLead.hidden = !this.up || !!this.defi;
    e.tRankLead.textContent = lead ? `À battre : ${lead.nom}, ${rankFmt(lead.score)} !` : 'Personne au tableau cette semaine : la place est libre !';
  },

  // ── Début de partie : jeton demandé tout de suite, la partie continue pendant ce temps ──
  begin(c, seed) {
    const eligible = this.eligible(c);
    const st = { eligible, ranked: eligible && this.up !== false, id: null, wait: null, failed: false };
    if (st.ranked) {
      // v1.30 : la graine de la partie est déposée avec le jeton, avant de jouer (on ne peut plus la choisir après coup)
      st.wait = this.call('partie', { graine: seed >>> 0 }).then((r) => { st.id = r.partie; this.up = true; }, () => { st.failed = true; });
    }
    this.game = st;
    return st;
  },

  // ── Fin de partie : section du classement sur l'addition ──
  onEnd(gm, c) {
    const st = this.game || {}, e = this.el;
    // v1.30 (anti-triche) : le journal des gestes accompagne le score ; le serveur rejoue la partie pour le vérifier.
    const rejeu = { v: LOGIC_ID, graine: gm.seed, guide: !!gm.guide, hints: !!c.hints, opts: gm.opts, pas: gm.n, log: gm.log };
    this.end = { game: st, sent: false, payload: { score: gm.score, boissons: gm.stats.drinks, combo: gm.bestCombo, erreurs: gm.stats.errors, partis: gm.stats.left, rejeu } };
    for (const k of ['eRankForm', 'eRankTop', 'eRankAll', 'eRankRename', 'eRankRetry', 'eRankReset']) e[k].hidden = true;
    this.msg('');
    if (!st.eligible) {
      e.eRank.hidden = !this.up;
      this.msg('Réglages de test modifiés : partie hors classement.');
      e.eRankReset.hidden = false;
      return;
    }
    if (!st.ranked) { e.eRank.hidden = true; return; }
    e.eRank.hidden = false;
    const name = this.name;
    if (name) this.submit(name);
    else this.showForm('');
  },

  showForm(v) {
    const e = this.el;
    e.eRankForm.hidden = false; e.eName.value = v || '';
    e.eRankTop.hidden = e.eRankAll.hidden = e.eRankRename.hidden = e.eRankRetry.hidden = true;
    this.msg('');
  },

  msg(html) { this.el.eRankMsg.innerHTML = html; this.el.eRankMsg.hidden = !html; },

  async submit(raw) {
    const end = this.end, e = this.el;
    if (!end || end.sent || end.busy) return;
    const nom = String(raw || '').replace(/\s+/g, ' ').trim();
    if (nom.length < 2) { this.msg('Ton nom : 2 lettres au moins.'); return; }
    const st = end.game;
    end.busy = true; e.eRankGo.disabled = true; e.eRankRetry.hidden = true;
    this.msg('Inscription au tableau…');
    try {
      if (!st.id && st.wait) await st.wait;
      if (!st.id) { end.busy = false; e.eRankForm.hidden = true; this.msg('Pas de réseau au début de la partie : score non inscrit.'); return; }
      const r = await this.call('score', Object.assign({ partie: st.id, nom, cle: this.secret }, end.payload));
      if (this.end !== end) return; // une autre partie a commencé entre-temps
      end.sent = true;
      this.name = r.nom;
      this.last = r;
      this.data = { semaine: r.semaine, du: r.semaine, top: r.top, joueurs: r.joueurs };
      this.dataAll = null;   // le top de tous les temps a pu bouger : il sera relu à l'ouverture
      this.paintTitle();
      this.showResult(r);
    } catch (err) {
      if (this.end !== end) return;
      if (err.code === 'nom' || err.code === 'nom-pris') { this.name = ''; this.showForm(nom); this.msg(err.message); }
      else if (err.server) { e.eRankForm.hidden = true; this.msg(err.message); }
      else { this.msg('Pas de réseau : score pas encore inscrit.'); e.eRankRetry.hidden = false; }
    } finally {
      end.busy = false; e.eRankGo.disabled = false;
    }
  },

  showResult(r) {
    const e = this.el, sur = r.joueurs > 1 ? ` sur ${r.joueurs}` : '';
    e.eRankForm.hidden = true;
    let line;
    if (r.record) line = r.rang === 1 ? `<b>1er</b> de la semaine${sur ? ` (${r.joueurs} joueurs)` : ''} !` : `<b>${rankOrd(r.rang)}</b>${sur} cette semaine`;
    else line = `Ton meilleur reste <b>${rankFmt(r.meilleur)}</b> : ${rankOrd(r.rang)}${sur}`;
    const t = r.tout, absolu = t && t.record && t.rang <= 10
      ? `<small class="r-rank-all">${t.rang === 1 ? 'Et record absolu du jeu !' : `Et ${rankOrd(t.rang)} de tous les temps !`}</small>` : '';
    this.msg(`${line}<small>au nom de ${esc(r.nom)}</small>${absolu}`);
    // Les trois premiers, puis ta ligne si tu n'y es pas
    const me = rankKey(r.nom), ol = e.eRankTop;
    ol.innerHTML = '';
    r.top.slice(0, 3).forEach((p, i) => ol.appendChild(rankRow(i + 1, p.nom, p.score, rankKey(p.nom) === me)));
    if (r.rang > 3) {
      const gap = document.createElement('li'); gap.className = 'gap'; gap.setAttribute('aria-hidden', 'true'); gap.textContent = '· · ·'; ol.appendChild(gap);
      ol.appendChild(rankRow(r.rang, r.nom, r.meilleur, true));
    }
    ol.hidden = false;
    e.eRankAll.hidden = false; e.eRankRename.hidden = false;
  },

  // ── Ardoise du top : onglets « Cette semaine » et « De tous les temps » ──
  open(from) {
    this.back = from;
    // v1.45 : le gros bouton doré lance une partie, comme celui de l'écran d'où l'on vient
    document.getElementById('bRankPlay').textContent = from === 'sEnd' ? 'Rejouer' : THEME.ouvrir;
    showScreen('sRank');
    this.el.sRank.scrollTop = 0;
    this.show('semaine');
  },
  show(tab) {
    this.tab = tab;
    this.paintBoard();
    if (tab === 'tout') this.refreshAll(); else this.refresh();
  },
  close() { showScreen(this.back); },
  paintBoard() {
    const e = this.el, all = this.tab === 'tout', d = all ? this.dataAll : this.data;
    e.kTabWeek.setAttribute('aria-selected', String(!all)); e.kTabAll.setAttribute('aria-selected', String(all));
    e.kTitle.textContent = all ? 'Top de tous les temps' : 'Top de la semaine';
    if (all) {
      const depuis = d && d.depuis ? new Date(d.depuis).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }) : null;
      e.kWeek.textContent = depuis ? `Meilleur score de chacun depuis le ${depuis}` : 'Meilleur score de chacun, jamais remis à zéro';
    } else {
      const du = d && (d.du || d.semaine);
      e.kWeek.textContent = du ? `Semaine du lundi ${new Date(du + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })} · remise à zéro lundi` : 'Remise à zéro chaque lundi';
    }
    const me = rankKey(this.name), top = (d && d.top) || [];
    e.kList.innerHTML = '';
    top.forEach((p, i) => e.kList.appendChild(rankRow(i + 1, p.nom, p.score, !!me && rankKey(p.nom) === me)));
    e.kList.hidden = !top.length; e.kEmpty.hidden = !!top.length || !d;
    e.kEmpty.textContent = all ? 'Personne au tableau pour l’instant.' : 'Personne encore cette semaine. À toi d’ouvrir le bal !';
    const l = this.last, mineRang = l && (all ? l.tout && l.tout.rang : d && l.semaine === d.semaine && l.rang);
    const mine = !!mineRang && mineRang > top.length;
    e.kMine.hidden = !mine;
    if (mine) e.kMine.textContent = `Toi : ${rankOrd(mineRang)} avec ${rankFmt(all ? l.tout.meilleur : l.meilleur)}`;
  },
};

function rankRow(n, nom, score, me) {
  const li = document.createElement('li');
  if (me) li.className = 'me';
  const a = document.createElement('span'); a.className = 'k-n';
  if (n <= 3) { a.className = 'k-n k-med'; a.dataset.m = n; a.innerHTML = `<span class="sr-only">${n}.</span>`; }   // médaille or, argent, bronze
  else a.textContent = n + '.';
  const b = document.createElement('span'); b.className = 'k-nom'; b.textContent = nom;
  const c = document.createElement('span'); c.className = 'k-sc'; c.textContent = rankFmt(score);
  li.append(a, b, c);
  return li;
}
function esc(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
