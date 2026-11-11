// Assemble le jeu en une seule page : node build.mjs → dist/galopins-arcade.html
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const src = (f) => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const order = ['theme.js', 'config.js', 'core.js', 'bot.js', 'audio.js', 'portraits.js', 'render.js', 'scene.js', 'coach.js', 'classement.js', 'story.js', 'main.js'];
const MIME = { png: 'image/png', webp: 'image/webp', woff2: 'font/woff2' };
const asset = (file) => (OPTIONAL.has(file) && !fs.existsSync(new URL('./assets/' + file, import.meta.url))) ? '' : `data:${MIME[file.split('.').pop()]};base64,${fs.readFileSync(new URL('./assets/' + file, import.meta.url)).toString('base64')}`;
// Images embarquées dans le code : marque à remplacer → fichier dans assets/
const SCRIPT_ASSETS = {
  // v1.25 : tout en WebP (page 2,7 → 1,6 Mo) ; l'ardoise des stations n'est embarquée qu'une fois (cadres d'événements et menus la réutilisent)
  __DRINK_ART_DATA__: 'drinks/drinks.webp',
  __SERVICE_PANEL_DATA__: 'ui/service-wood.webp',
  __STATION_PANEL_DATA__: 'ui/station-slate.webp',
  __UI_ICONS_DATA__: 'ui/icons.webp',
  __TRAY_DATA__: 'ui/tray-metal.webp',
  __ANAIS_DATA__: 'characters/anais.webp',
  // Visuels de ChatGPT (sources dans assets/sources/), découpés par tools/pack-chatgpt.py et tools/pack-friend.py
  __TEAM_DATA__: 'characters/team.webp',
  __MAX_ACCUEIL_DATA__: 'characters/max-accueil.webp',
  __CARD_ALEX_DATA__: 'characters/card-alex.webp',
  __CARD_HUGO_DATA__: 'characters/card-hugo.webp',
  __NICO_DATA__: 'characters/nico.webp',
  __ROXANE_DATA__: 'characters/roxane.webp',
  __JEREMY_DATA__: 'characters/jeremy.webp',
  __ELEA_DATA__: 'characters/elea.webp',   // Volta
  __NISE_DATA__: 'characters/nise.webp',   // Volta
  // v1.17 (Volta) : à la place des clients de base de Galopins (customers.webp n'est plus dans la page, gardé comme référence de style)
  __RAYAN_DATA__: 'characters/rayan.webp',
  __JORDAN_DATA__: 'characters/jordan.webp',
  __HELENE_DATA__: 'characters/helene.webp',
  __KENZA_DATA__: 'characters/kenza.webp',
  __NEON_ON_DATA__: 'ui/neon-on.webp',
  __NEON_OFF_DATA__: 'ui/neon-off.webp',
  __BELL_DATA__: 'ui/bell.webp',
  __BELL_ARM_DATA__: 'ui/bell-arm.webp',
  __SHUTTER_TILE_DATA__: 'ui/shutter-tile.webp',
  __SHUTTER_BAR_DATA__: 'ui/shutter-bar.webp',
  __TICKET_DATA__: 'ui/ticket.webp',
  __ARDOISE_DATA__: 'ui/ardoise.webp',
  // v1.18 : stout en 6 étapes (tools/pack-stout.py) et visuels du classement (tools/pack-rank.py)
  __STOUT_STEPS_DATA__: 'drinks/stout-steps.webp',
  __RANK_ICONS_DATA__: 'ui/rank-icons.webp',
  // v1.19 : salle plus profonde (ChatGPT). v1.32 : nette partout, avec les gens attablés (préférée par les testeurs) ; la version floue est retirée.
  __ROOM_DEPTH_DATA__: 'room/room-depth.webp',
  // v1.26 : Jérémie (contrôle qualité). Facultatifs : tant que les fichiers manquent, la marque devient '' (pas de Jérémie en public).
  __JEREMIE_DATA__: 'characters/jeremie.webp',
  __CARD_JEREMIE_DATA__: 'characters/card-jeremie.webp',
  // v1.43 : fond de la story Instagram (ChatGPT, assets/sources/story-fond.png → WebP 86). Facultatif : sans lui, l'ancienne composition.
  __STORY_BG_DATA__: 'ui/story-fond.webp',
};
const OPTIONAL = new Set(['characters/jeremie.webp', 'characters/card-jeremie.webp', 'ui/story-fond.webp']);
const STYLE_ASSETS = {
  __FONT_JERSEY_DATA__: 'fonts/jersey-10.woff2',   // police pixel des titres et des chiffres (OFL)
  __FONT_VT323_DATA__: 'fonts/vt323.woff2',        // police du ticket de caisse (OFL)
};
const fill = (text, map) => Object.entries(map).reduce((t, [mark, file]) => {
  if (!t.includes(mark)) throw new Error(`marque absente : ${mark}`);
  return t.split(mark).join(asset(file));
}, text);
// v1.30 (anti-triche) : la logique du jeu (réglages + core) est copiée dans worker/jeu.js, que le Worker utilise pour rejouer
// les parties. LOGIC_ID, empreinte de cette logique, voyage avec chaque score : le serveur ne compare que des versions identiques.
const LOGIC = ['config.js', 'core.js'].map((f) => src(f)).join('\n');
const LOGIC_ID = createHash('sha256').update(LOGIC).digest('hex').slice(0, 12);
fs.writeFileSync(new URL('./worker/jeu.js', import.meta.url),
  `// Généré par build.mjs : ne pas modifier à la main (copie de src/config.js et src/core.js pour le Worker).\n` +
  `export const LOGIC_ID = '${LOGIC_ID}';\n${LOGIC}\nexport { DEFAULTS, Game, replayGame, GAME_STEP, REPLAY_CODES };\n`);
// v1.56 (Galopins) : code et styles de la page compressés par esbuild (commentaires retirés, noms raccourcis, tout dans une fonction).
// Les sources restent lisibles dans src/ (dépôt privé). Les images sont posées après la compression. Sans esbuild (`npm install`), page non compressée.
let esbuild = null;
try { esbuild = await import('esbuild'); } catch (e) { console.warn('esbuild absent (npm install) : page non compressée'); }
// Thème (src/theme.js) : les {{marques}} de la page prennent les valeurs du lieu
const THEME = new Function(src('theme.js') + '\nreturn THEME;')();
const COPYRIGHT = `${THEME.copyright}. Tous droits réservés.`;
const tag = THEME.insta ? '@' + THEME.insta : '';
const MARKS = { ...THEME, tague: tag ? 'tague ' + tag : 'partage ton score', liTag: tag ? `<li><span>Tague <b>${tag}</b></span></li>` : '', taguant: tag ? ` en taguant <b>${tag}</b>` : '' };
let code = `const LOGIC_ID = '${LOGIC_ID}';\n` + order.map((f) => `// ===== ${f} =====\n${src(f)}`).join('\n');
let css = src('style.css');
if (esbuild) {
  code = (await esbuild.transform(`(() => {\n${code}\n})();`, { minify: true, charset: 'utf8', legalComments: 'none' })).code;
  css = (await esbuild.transform(css, { loader: 'css', minify: true, charset: 'utf8', legalComments: 'none' })).code;
}
const script = `/*! ${THEME.jeu} · ${COPYRIGHT} */\n` + fill(code, SCRIPT_ASSETS);
// Commentaires de la page retirés aussi ; seule la mention des droits reste en tête, visible par qui affiche le code source.
const html = src('template.html').replace(/<!--[\s\S]*?-->\n?/g, '')
  .replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in MARKS)) throw new Error('marque de thème inconnue : ' + k); return MARKS[k]; })
  .replace('<meta name="author"', () => `<!-- ${THEME.jeu} · ${COPYRIGHT} -->\n<meta name="author"`)
  .replace('/*__STYLE__*/', () => fill(css, STYLE_ASSETS))
  .replace('/*__SCRIPT__*/', () => script);
fs.mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./dist/galopins-arcade.html', import.meta.url), html);
console.log('dist/galopins-arcade.html', (html.length / 1024).toFixed(1) + ' Ko', esbuild ? '(code compressé)' : '(code non compressé)');
console.log('worker/jeu.js', 'logique', LOGIC_ID);
