// Galopins Arcade — Worker Cloudflare.
// Les fichiers de `dist/` sont servis directement par Cloudflare ; ce script ne reçoit
// que les adresses qui ne correspondent à aucun fichier :
// - « / » (l'adresse du QR code) affiche le jeu, `dist/galopins-arcade.html` ;
// - /api/… : le classement hebdomadaire, dans la base D1 `galopins-scores` (liaison DB).
//
// Classement (voir AGENTS.md) : une semaine va du lundi 0 h au dimanche 24 h, heure de Paris.
// Seul le meilleur score de chaque nom compte. Garde-fous simples contre la triche : jeton de
// partie demandé au lancement, score refusé s'il arrive trop tôt, plafonds de score et de boissons,
// filtre sur les noms. Depuis la v1.18, aussi un top « de tous les temps » (table `records`, meilleur score de chaque nom).
// Modération : supprimer la ligne du nom dans `meilleurs` et dans `records` (console D1).
//
// Anti-triche (v1.30) : le téléphone envoie avec son score le journal de ses gestes ; le Worker rejoue la partie avec
// la même logique (worker/jeu.js, copie de src/config.js et src/core.js faite par build.mjs) et recalcule le score.
// Variable REJEU (wrangler.jsonc) : « observer » (le score est inscrit comme avant, la partie est rejouée après la réponse
// et le résultat noté dans `rejeux`), « exiger » (score refusé si le rejeu ne donne pas le même), « off » (rien).
// Bilan lisible : GET /api/rejeu. Noms réservés (v1.30) : le premier téléphone qui inscrit un nom le garde (table `noms`).

import { LOGIC_ID, DEFAULTS, replayGame, REPLAY_CODES } from './jeu.js';

// Cloudflare sert les pages HTML sans leur extension : `dist/galopins-arcade.html` répond à cette adresse.
const GAME = '/galopins-arcade';

const LIMITES = {
  scoreMax: 90000,        // ≈ 2 × le meilleur bot « expert » (39 000 en moyenne en tirage)
  boissonsMax: 130,       // le bot expert en sert 77 en tirage
  parBoisson: 1200,       // score ≤ boissons × 1200 + bonus fixes
  bonusFixes: 5000,
  minSecondes: 110,       // une partie dure 120 s de chrono (plus les pauses) : réglable par la variable MIN_SECONDES
  jetonHeures: 3,         // durée de validité d'un jeton de partie
  gestesMax: 20000,       // journal d'une partie (≈ 430 gestes en moyenne)
  pasMax: 216000,         // 1 h de jeu au plus, pauses d'apprentissage comprises
  partiesParHeure: 300,   // par adresse IP (le wifi du bar est partagé)
  top: 10,
  tousScores: 3000,       // v1.54 : scores renvoyés à l'accueil pour situer une partie (≈ 6 octets chacun)
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(request, env, url, ctx);
      } catch (e) {
        console.error('api', e && e.stack || e);
        return json({ erreur: 'Le classement ne répond pas. Réessaie dans un instant.', code: 'serveur' }, 500);
      }
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const res = await env.ASSETS.fetch(new Request(new URL(GAME, url), request));
      // Le jeu évolue souvent : le téléphone revérifie la version à chaque ouverture.
      const out = new Response(res.body, res);
      out.headers.set('Cache-Control', 'no-cache');
      out.headers.set('Content-Type', 'text/html; charset=utf-8'); // Cloudflare l'envoie sans encodage : les accents passeraient mal
      return out;
    }

    return env.ASSETS.fetch(request);
  },
};

// ── API ──
async function api(request, env, url, ctx) {
  if (!env.DB) return json({ erreur: 'Classement pas encore branché.', code: 'indispo' }, 503);
  await schema(env.DB);
  const route = request.method + ' ' + url.pathname.replace(/\/+$/, '');
  if (route === 'GET /api/classement') return url.searchParams.get('periode') === 'tout' ? classementTout(env.DB) : classement(env.DB);
  if (route === 'POST /api/partie') return partie(request, env.DB);
  if (route === 'POST /api/score') return score(request, env, ctx);
  if (route === 'GET /api/rejeu') return bilan(env);
  return json({ erreur: 'Adresse inconnue.', code: 'route' }, 404);
}

// Tables créées au premier appel (une fois par instance du Worker).
let pret = null;
function schema(db) {
  if (!pret) {
    pret = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS parties (id TEXT PRIMARY KEY, semaine TEXT NOT NULL, cree INTEGER NOT NULL, ip TEXT, utilise INTEGER NOT NULL DEFAULT 0)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS parties_ip ON parties (ip, cree)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT, semaine TEXT NOT NULL, nom TEXT NOT NULL, cle TEXT NOT NULL,
        score INTEGER NOT NULL, boissons INTEGER, combo INTEGER, erreurs INTEGER, partis INTEGER, secondes INTEGER, cree INTEGER NOT NULL)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS meilleurs (semaine TEXT NOT NULL, cle TEXT NOT NULL, nom TEXT NOT NULL, score INTEGER NOT NULL, cree INTEGER NOT NULL,
        PRIMARY KEY (semaine, cle))`),
      db.prepare(`CREATE INDEX IF NOT EXISTS meilleurs_rang ON meilleurs (semaine, score DESC)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS records (cle TEXT PRIMARY KEY, nom TEXT NOT NULL, score INTEGER NOT NULL, cree INTEGER NOT NULL, semaine TEXT NOT NULL)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS records_rang ON records (score DESC)`),
      // v1.30 : résultat du rejeu de chaque partie classée, et noms réservés (empreinte de la clé du téléphone, jamais la clé)
      db.prepare(`CREATE TABLE IF NOT EXISTS rejeux (partie TEXT PRIMARY KEY, cree INTEGER NOT NULL, nom TEXT, annonce INTEGER, calcule INTEGER,
        pas INTEGER, gestes INTEGER, statut TEXT NOT NULL, version TEXT)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS rejeux_cree ON rejeux (cree)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS noms (cle TEXT PRIMARY KEY, empreinte TEXT NOT NULL, cree INTEGER NOT NULL)`),
      // v1.54 : par jour (heure de Paris) : parties classées commencées, scores inscrits, nouveaux noms — pour mesurer l'inscription
      db.prepare(`CREATE TABLE IF NOT EXISTS jours (jour TEXT PRIMARY KEY, parties INTEGER NOT NULL DEFAULT 0, inscrites INTEGER NOT NULL DEFAULT 0,
        nouveaux INTEGER NOT NULL DEFAULT 0)`),
    ]).then(async () => {
      // v1.30 : graine de la partie, déposée avec le jeton (colonne ajoutée à la table existante ; déjà là → erreur ignorée)
      await db.prepare(`ALTER TABLE parties ADD COLUMN graine INTEGER`).run().catch(() => {});
      // Première fois : la table des records se remplit avec les parties déjà inscrites (meilleur score de chaque nom).
      const deja = await db.prepare(`SELECT 1 FROM records LIMIT 1`).first();
      if (!deja) await db.prepare(`INSERT OR IGNORE INTO records (cle, nom, score, cree, semaine) SELECT cle, nom, MAX(score), cree, semaine FROM scores GROUP BY cle`).run();
    }).catch((e) => { pret = null; throw e; });
  }
  return pret;
}

// GET /api/classement → le top de la semaine en cours
async function classement(db) {
  const s = semaine(Date.now());
  return json(Object.assign({ periode: 'semaine', semaine: s.cle, du: s.lundi, au: s.dimanche }, await tableau(db, s.cle, true)));
}

// GET /api/classement?periode=tout → le top de tous les temps
async function classementTout(db) {
  return json(Object.assign({ periode: 'tout' }, await tableauTout(db)));
}

async function tableauTout(db) {
  const [top, n, debut] = await db.batch([
    db.prepare(`SELECT nom, score FROM records ORDER BY score DESC, cree ASC LIMIT ?`).bind(LIMITES.top),
    db.prepare(`SELECT COUNT(*) AS n FROM records`),
    db.prepare(`SELECT MIN(cree) AS t FROM records`),
  ]);
  return { top: top.results, joueurs: n.results[0].n, depuis: debut.results[0].t };
}

async function tableau(db, cle, tous) {
  const [top, n, sc] = await db.batch([
    db.prepare(`SELECT nom, score FROM meilleurs WHERE semaine = ? ORDER BY score DESC, cree ASC LIMIT ?`).bind(cle, LIMITES.top),
    db.prepare(`SELECT COUNT(*) AS n FROM meilleurs WHERE semaine = ?`).bind(cle),
    // v1.54 : tous les meilleurs scores de la semaine (sans les noms) : le téléphone situe n'importe quel score, pas seulement le top 10
    db.prepare(`SELECT score FROM meilleurs WHERE semaine = ? ORDER BY score DESC LIMIT ?`).bind(cle, tous ? LIMITES.tousScores : 0),
  ]);
  const t = { top: top.results, joueurs: n.results[0].n };
  if (tous) t.scores = sc.results.map((r) => r.score);
  return t;
}

// POST /api/partie → jeton à garder pendant la partie
async function partie(request, db) {
  const maintenant = Date.now();
  const b = await corps(request) || {};
  const graine = Number.isInteger(b.graine) && b.graine >= 0 && b.graine <= 0xFFFFFFFF ? b.graine : null;
  const ip = await empreinte(request.headers.get('CF-Connecting-IP') || '');
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM parties WHERE ip = ? AND cree > ?`).bind(ip, maintenant - 3600e3).first();
  if (r.n >= LIMITES.partiesParHeure) return json({ erreur: 'Trop de parties d’un coup : fais une pause !', code: 'limite' }, 429);
  const id = crypto.randomUUID(), s = semaine(maintenant);
  const ops = [db.prepare(`INSERT INTO parties (id, semaine, cree, ip, graine) VALUES (?, ?, ?, ?, ?)`).bind(id, s.cle, maintenant, ip, graine),
    db.prepare(`INSERT INTO jours (jour, parties) VALUES (?, 1) ON CONFLICT (jour) DO UPDATE SET parties = parties + 1`).bind(jourParis(maintenant))];
  // Ménage de temps en temps : les jetons de plus d'un jour ne servent plus.
  if (Math.random() < 0.02) ops.push(db.prepare(`DELETE FROM parties WHERE cree < ?`).bind(maintenant - 86400e3));
  await db.batch(ops);
  return json({ partie: id, semaine: s.cle }, 201);
}

// POST /api/score → inscrit le score, renvoie le rang et le top
async function score(request, env, ctx) {
  const db = env.DB;
  const b = await corps(request);
  if (!b) return json({ erreur: 'Requête illisible.', code: 'requete' }, 400);

  const nom = nettoyerNom(b.nom);
  if (!nom) return json({ erreur: 'Ton nom : de 2 à 12 lettres ou chiffres.', code: 'nom' }, 400);
  const cle = cleNom(nom);
  if (interdit(cle)) return json({ erreur: 'Ce nom n’est pas accepté au tableau. Choisis-en un autre.', code: 'nom' }, 400);

  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : -1);
  const sc = n(b.score), boissons = n(b.boissons), combo = n(b.combo), erreurs = n(b.erreurs), partis = n(b.partis);
  if ([sc, boissons, combo, erreurs, partis].some((v) => v < 0) || typeof b.partie !== 'string') return json({ erreur: 'Score illisible.', code: 'requete' }, 400);

  const p = await db.prepare(`SELECT * FROM parties WHERE id = ?`).bind(b.partie).first();
  const maintenant = Date.now();
  if (!p) return json({ erreur: 'Partie inconnue.', code: 'partie' }, 400);
  if (p.utilise) return json({ erreur: 'Ce score est déjà inscrit.', code: 'deja' }, 409);
  const secondes = Math.round((maintenant - p.cree) / 1000);
  const minSec = env.MIN_SECONDES !== undefined ? Number(env.MIN_SECONDES) : LIMITES.minSecondes;
  if (secondes < minSec) return json({ erreur: 'Partie trop courte pour le classement.', code: 'triche' }, 400);
  if (secondes > LIMITES.jetonHeures * 3600) return json({ erreur: 'Partie trop ancienne pour le classement.', code: 'partie' }, 400);
  if (sc > LIMITES.scoreMax || boissons > LIMITES.boissonsMax || sc > boissons * LIMITES.parBoisson + LIMITES.bonusFixes || combo > boissons) {
    return json({ erreur: 'Score refusé par le classement.', code: 'triche' }, 400);
  }

  // v1.30 : nom réservé au premier téléphone qui l'inscrit
  const info = {};
  const pris = await nomReserve(db, cle, b.cle, maintenant, info);
  if (pris) return json({ erreur: 'Ce nom est déjà pris sur un autre téléphone. Choisis-en un autre.', code: 'nom-pris' }, 409);

  // v1.30 : rejeu de la partie. « exiger » : vérifié avant d'inscrire ; « observer » : après la réponse, sans rien refuser.
  const mode = env.REJEU || 'observer';
  const ligne = { partie: b.partie, cree: maintenant, nom, annonce: sc };
  if (mode === 'exiger') {
    const v = verifier(b.rejeu, p, { sc, boissons, combo, erreurs, partis });
    await noterRejeu(db, Object.assign(ligne, v));
    if (v.statut === 'version') return json({ erreur: 'Le jeu vient d’être mis à jour : recharge la page pour être classé.', code: 'version' }, 409);
    if (v.statut !== 'ok') return json({ erreur: 'Score refusé par le classement.', code: 'triche' }, 400);
  } else if (mode === 'observer') {
    // ligne « en attente » tout de suite : si le calcul est coupé (limite de Cloudflare), elle le reste et le bilan le montre
    await noterRejeu(db, Object.assign({}, ligne, { statut: b.rejeu ? 'en_attente' : 'absent', version: b.rejeu && String(b.rejeu.v || '').slice(0, 16) }));
    if (b.rejeu && ctx && ctx.waitUntil) {
      const rj = b.rejeu, chiffres = { sc, boissons, combo, erreurs, partis };
      ctx.waitUntil(Promise.resolve().then(() => noterRejeu(db, Object.assign({}, ligne, verifier(rj, p, chiffres)))).catch((e) => console.error('rejeu', e)));
    }
  }

  // Le jeton ne sert qu'une fois : la mise à jour ne passe que s'il n'a pas encore été utilisé.
  const u = await db.prepare(`UPDATE parties SET utilise = 1 WHERE id = ? AND utilise = 0`).bind(b.partie).run();
  if (!u.meta.changes) return json({ erreur: 'Ce score est déjà inscrit.', code: 'deja' }, 409);
  // v1.54 : compté au jour où la partie a commencé (un score gardé au chaud et inscrit plus tard compte pour sa partie)
  await db.prepare(`INSERT INTO jours (jour, inscrites, nouveaux) VALUES (?, 1, ?) ON CONFLICT (jour) DO UPDATE SET inscrites = inscrites + 1, nouveaux = nouveaux + excluded.nouveaux`)
    .bind(jourParis(p.cree), info.nouveau ? 1 : 0).run();

  const cleSemaine = p.semaine;
  const [, , moi, , moiTout] = await db.batch([
    db.prepare(`INSERT INTO scores (semaine, nom, cle, score, boissons, combo, erreurs, partis, secondes, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(cleSemaine, nom, cle, sc, boissons, combo, erreurs, partis, secondes, maintenant),
    db.prepare(`INSERT INTO meilleurs (semaine, cle, nom, score, cree) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (semaine, cle) DO UPDATE SET score = excluded.score, nom = excluded.nom, cree = excluded.cree WHERE excluded.score > meilleurs.score`)
      .bind(cleSemaine, cle, nom, sc, maintenant),
    db.prepare(`SELECT score, cree FROM meilleurs WHERE semaine = ? AND cle = ?`).bind(cleSemaine, cle),
    db.prepare(`INSERT INTO records (cle, nom, score, cree, semaine) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (cle) DO UPDATE SET score = excluded.score, nom = excluded.nom, cree = excluded.cree, semaine = excluded.semaine WHERE excluded.score > records.score`)
      .bind(cle, nom, sc, maintenant, cleSemaine),
    db.prepare(`SELECT score, cree FROM records WHERE cle = ?`).bind(cle),
  ]);
  const best = moi.results[0], bestTout = moiTout.results[0];
  const [avant, avantTout, t] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM meilleurs WHERE semaine = ? AND (score > ? OR (score = ? AND cree < ?))`).bind(cleSemaine, best.score, best.score, best.cree).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM records WHERE score > ? OR (score = ? AND cree < ?)`).bind(bestTout.score, bestTout.score, bestTout.cree).first(),
    tableau(db, cleSemaine, true),
  ]);
  const tout = { rang: avantTout.n + 1, meilleur: bestTout.score, record: bestTout.score === sc && bestTout.cree === maintenant };
  return json(Object.assign({ ok: true, semaine: cleSemaine, nom, score: sc, meilleur: best.score, record: best.score === sc && best.cree === maintenant, rang: avant.n + 1, tout }, t));
}

// ── Outils ──
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function corps(request) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return null;
  const txt = await request.text();
  if (txt.length > 400000) return null;   // v1.30 : le journal des gestes (≈ 5 Ko par partie, 20 000 gestes au plus)
  try { const o = JSON.parse(txt); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
}

// IP réduite à une empreinte : on ne garde jamais l'adresse elle-même, et les jetons sont effacés au bout d'un jour.
async function empreinte(ip) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('galopins|' + ip));
  return [...new Uint8Array(h).slice(0, 8)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// v1.54 : date du jour à Paris (AAAA-MM-JJ)
function jourParis(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

// Semaine du lundi au dimanche, heure de Paris. cle = date du lundi (AAAA-MM-JJ).
// Même calcul que `semaineParis` dans src/classement.js.
function semaine(ms) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
    .formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const jour = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
  const d = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day - jour));
  const iso = (x) => x.toISOString().slice(0, 10);
  const fin = new Date(d.getTime() + 6 * 86400e3);
  return { cle: iso(d), lundi: iso(d), dimanche: iso(fin) };
}

// Nom affiché : 2 à 12 caractères, lettres, chiffres, espace, apostrophe, point, tiret, tiret bas.
function nettoyerNom(v) {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 12) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’._-]*$/u.test(s)) return null;
  if (!/[\p{L}\p{N}].*[\p{L}\p{N}]/u.test(s)) return null;
  return s;
}

// Clé d'un nom : sans accents ni majuscules, pour qu'« Anaïs » et « anais » soient la même personne.
function cleNom(nom) {
  return nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
}

// Filtre des insultes : clé sans espaces ni ponctuation, chiffres lus comme des lettres (n1qu3 → nique).
const MOTS_EXACTS = ['con', 'conne', 'pd', 'fdp', 'ntm', 'tg', 'tagueule', 'cul', 'zob', 'sexe', 'sex', 'negre', 'negro', 'nazi', 'kkk', 'porn', 'porno'];
const MOTS_DEDANS = ['pute', 'putain', 'salope', 'salaud', 'encul', 'nique', 'niker', 'connard', 'connass', 'batard', 'bite', 'couille', 'chatte', 'pede', 'tapette',
  'negresse', 'bougnoul', 'youpin', 'hitler', 'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'whore', 'nigg', 'fag', 'penis', 'vagin', 'branle', 'suceu', 'suce'];
// Prénoms et mots courants qui contiennent un mot interdit (v1.25 : Dominique, Monique, Véronique étaient refusés).
// Ils sont retirés avant la recherche ; « nique » seul ou « niquetamere » restent refusés.
const MOTS_PERMIS = ['dominique', 'monique', 'veronique', 'annique', 'pedersen', 'dickson', 'dickens', 'bitencourt',
  'deput', 'comput', 'disput', 'reput', 'imput'];
function interdit(cle) {
  const lu = cle.replace(/[0134578@$]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' }[c]));
  const serre = MOTS_PERMIS.reduce((s, m) => s.split(m).join(' '), lu.replace(/[^a-z]/g, ''));
  const mots = lu.replace(/[^a-z ]/g, ' ').split(' ').filter(Boolean);
  if (MOTS_EXACTS.includes(serre) || mots.some((m) => MOTS_EXACTS.includes(m))) return true;
  return MOTS_DEDANS.some((m) => serre.includes(m));
}

// ── Anti-triche (v1.30) ──
// Rejoue la partie à partir du journal des gestes et compare au score annoncé.
// statut : ok · ecart (le rejeu ne donne pas le même résultat) · version (page d'une autre version du jeu)
// · invalide (journal mal formé) · graine (pas celle déposée avec le jeton) · absent (pas de journal : ancienne page) · erreur.
function verifier(rj, p, chiffres) {
  if (!rj || typeof rj !== 'object') return { statut: 'absent' };
  const version = String(rj.v || '').slice(0, 16);
  if (rj.v !== LOGIC_ID) return { statut: 'version', version };
  const log = rj.log, graine = rj.graine;
  if (!Array.isArray(log) || log.length > LIMITES.gestesMax || !Number.isInteger(graine) || graine < 0 || graine > 0xFFFFFFFF) return { statut: 'invalide', version };
  let avant = 0;
  for (const e of log) {
    if (!Array.isArray(e) || e.length < 2 || e.length > 3) return { statut: 'invalide', version };
    const [pas, code, a] = e;
    if (!Number.isInteger(pas) || pas < avant || pas > LIMITES.pasMax || typeof code !== 'string' || code.length !== 1 || !REPLAY_CODES.includes(code)) return { statut: 'invalide', version };
    if (e.length === 3 && !(Number.isInteger(a) && a >= 0 && a <= 3)) return { statut: 'invalide', version };
    avant = pas;
  }
  if (p.graine !== null && p.graine !== undefined && p.graine !== graine) return { statut: 'graine', version, gestes: log.length };
  try {
    const cfg = Object.assign({}, DEFAULTS, { hints: !!rj.hints });   // partie classée : réglages par défaut (le guidage est du confort)
    const opts = { noJeremie: !!(rj.opts && rj.opts.noJeremie) };
    const g = replayGame(cfg, graine, opts, { guide: !!rj.guide, log }, LIMITES.pasMax);
    const s = g.stats;
    const ok = g.over && g.score === chiffres.sc && s.drinks === chiffres.boissons && g.bestCombo === chiffres.combo
      && s.errors === chiffres.erreurs && s.left === chiffres.partis;
    return { statut: ok ? 'ok' : 'ecart', calcule: g.score, pas: g.n, gestes: log.length, version };
  } catch (e) {
    console.error('rejeu', e && e.stack || e);
    return { statut: 'erreur', gestes: log.length, version };
  }
}

async function noterRejeu(db, r) {
  await db.prepare(`INSERT INTO rejeux (partie, cree, nom, annonce, calcule, pas, gestes, statut, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (partie) DO UPDATE SET calcule = excluded.calcule, pas = excluded.pas, gestes = excluded.gestes, statut = excluded.statut, version = excluded.version`)
    .bind(r.partie, r.cree, r.nom, r.annonce, r.calcule ?? null, r.pas ?? null, r.gestes ?? null, r.statut, r.version ?? null).run();
}

// Nom réservé : la première inscription d'un nom enregistre l'empreinte de la clé du téléphone (jamais la clé elle-même).
// Renvoie true si le nom appartient à un autre téléphone. Une page sans clé (ancienne version) garde les noms encore libres.
async function nomReserve(db, cle, secret, maintenant, info = {}) {
  const valide = typeof secret === 'string' && /^[0-9a-f]{32}$/.test(secret);
  let row = await db.prepare(`SELECT empreinte FROM noms WHERE cle = ?`).bind(cle).first();
  if (!valide) return !!row;
  const h = await hachage('nom|' + secret);
  if (!row) {
    await db.prepare(`INSERT OR IGNORE INTO noms (cle, empreinte, cree) VALUES (?, ?, ?)`).bind(cle, h, maintenant).run();
    row = await db.prepare(`SELECT empreinte FROM noms WHERE cle = ?`).bind(cle).first();   // deux téléphones en même temps : le premier gagne
    info.nouveau = !!row && row.empreinte === h;   // v1.54 : premier passage de ce nom au tableau
  }
  return !row || row.empreinte !== h;
}

async function hachage(texte) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('galopins|' + texte));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// GET /api/rejeu → bilan lisible des vérifications des 7 derniers jours
async function bilan(env) {
  const db = env.DB, depuis = Date.now() - 7 * 86400e3;
  const [parStatut, derniers, jours] = await db.batch([
    db.prepare(`SELECT statut, COUNT(*) AS n FROM rejeux WHERE cree > ? GROUP BY statut`).bind(depuis),
    db.prepare(`SELECT cree, nom, annonce, calcule, statut FROM rejeux WHERE cree > ? AND statut NOT IN ('ok', 'absent') ORDER BY cree DESC LIMIT 15`).bind(depuis),
    db.prepare(`SELECT jour, parties, inscrites, nouveaux FROM jours ORDER BY jour DESC LIMIT 14`),
  ]);
  const c = Object.fromEntries(parStatut.results.map((r) => [r.statut, r.n]));
  const total = parStatut.results.reduce((a, r) => a + r.n, 0);
  const nb = (k) => c[k] || 0;
  const fmt = (x) => (x === null || x === undefined ? '—' : Number(x).toLocaleString('fr-FR'));
  const quand = (ms) => new Date(ms).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const NOMS = { ecart: 'écart', version: 'autre version', invalide: 'journal invalide', graine: 'graine changée', en_attente: 'calcul coupé', erreur: 'erreur' };
  const lignes = [
    `Volta Arcade · vérification des scores`,
    `Mode : ${env.REJEU || 'observer'} · version du jeu ${LOGIC_ID}`,
    ``,
    `7 derniers jours : ${total} partie${total > 1 ? 's' : ''} classée${total > 1 ? 's' : ''}`,
    `  rejouées à l'identique ............ ${nb('ok')}`,
    `  écart entre score et rejeu ........ ${nb('ecart')}`,
    `  calcul coupé par Cloudflare ....... ${nb('en_attente')}`,
    `  page d'une autre version .......... ${nb('version')}`,
    `  sans journal (ancienne page) ...... ${nb('absent')}`,
    `  journal invalide ou graine changée  ${nb('invalide') + nb('graine')}`,
    `  erreur pendant le rejeu ........... ${nb('erreur')}`,
  ];
  // v1.54 : combien de parties classées finissent au tableau (une partie abandonnée en route compte comme pas inscrite)
  lignes.push('', 'Inscriptions par jour (parties classées commencées → scores inscrits) :');
  if (!jours.results.length) lignes.push('  pas encore de partie comptée');
  for (const j of jours.results) {
    const pc = j.parties ? Math.round((100 * j.inscrites) / j.parties) : 0;
    lignes.push(`  ${j.jour.slice(8, 10)}/${j.jour.slice(5, 7)} · ${j.parties} commencée${j.parties > 1 ? 's' : ''} · ${j.inscrites} inscrite${j.inscrites > 1 ? 's' : ''} (${pc} %) · ${j.nouveaux} nouveau${j.nouveaux > 1 ? 'x' : ''} nom${j.nouveaux > 1 ? 's' : ''}`);
  }
  if (derniers.results.length) {
    lignes.push('', 'À regarder :');
    for (const r of derniers.results) lignes.push(`  ${quand(r.cree)} · ${r.nom} · annoncé ${fmt(r.annonce)} · rejoué ${fmt(r.calcule)} · ${NOMS[r.statut] || r.statut}`);
  }
  return new Response(lignes.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
