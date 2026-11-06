// ─────────────────────────────────────────────────────────────
// THÈME — tout ce qui fait « Volta » plutôt que « Galopins ».
// Modifier ici, puis `node build.mjs`. Le moteur du jeu (règles, gestes, scores) ne change pas.
// Les visuels sont dans `assets/` : même nom, même format, ils remplacent ceux de Galopins.
// ─────────────────────────────────────────────────────────────
const THEME = {
  jeu: 'Volta Arcade',                 // nom du jeu (onglet, partages, aperçu des liens)
  lieu: 'Volta',                       // nom du lieu, tel qu'on l'écrit dans une phrase
  chezLieu: 'chez Volta',              // « À bientôt chez Volta »
  auComptoir: 'Au comptoir de Volta',  // sous le titre de la story
  enseigne: 'VOLTA',                   // titre en capitales de la story
  adresse: '',                         // adresse sur la story (vide : pas de ligne)
  insta: '',                           // compte Instagram sans le @ (vide : pas de néon ni de tag Instagram)
  ouvrir: 'Ouvrir le Volta',          // gros bouton de l'accueil et du top 10
  emoji: '☕',                          // à la fin du message « Tu me bats ? »
  // Adresse publique (celle du QR code) et mot de son nom qui active le mode public
  urlPublique: 'https://volta.faucon-anais.workers.dev/',
  motPublic: 'volta',
};
