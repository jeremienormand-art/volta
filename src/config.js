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
